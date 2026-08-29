import { SUPABASE_URL } from '@/lib/supabase/client';
import type { Comic, ComicSearchResult } from '@/core/types/comic';

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-curator`;

export interface DeepSeekAnalysisResult {
  summary: string;
  rankedComics: ComicSearchResult[];
}

export async function analyzeAndRankWithDeepSeek(
  userQuery: string,
  candidateComics: Comic[],
  locale: 'id' | 'en' = 'id'
): Promise<DeepSeekAnalysisResult | null> {
  if (candidateComics.length === 0) {
    return null;
  }

  // Security Hardening: Sanitize user input & clamp length to prevent token abuse / injection
  const sanitizedQuery = userQuery
    .slice(0, 160)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  if (!sanitizedQuery) return null;

  // Hand over a wide pool and let the model discriminate. The status/chapters/
  // year fields are what let it honour "already completed, under 60 chapters";
  // without them it can only guess. The Edge Function re-clamps all of this.
  const promptCandidates = candidateComics.slice(0, 24).map((c) => ({
    id: c.id,
    title: c.title_english || c.title_romaji,
    type: c.type,
    // Set when AniList's character index produced this candidate. The catalog
    // has no character data, so this is the only way the model can know that
    // "the one whose MC is Lloyd" is *this* title.
    character: (c as ComicSearchResult).matchedCharacter,
    status: c.status,
    year: c.release_year ?? undefined,
    chapters: c.total_chapters ?? undefined,
    score: c.average_score ?? undefined,
    genres: c.genres?.join(', '),
    tags: c.tags?.slice(0, 8).join(', '),
    synopsis: c.synopsis ? c.synopsis.slice(0, 380) : '',
  }));

  try {
    const controller = new AbortController();
    // Bigger candidate pool + a much longer system prompt means more thinking
    // time upstream; 16s was clipping valid responses into the fallback path.
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    // Call Secure Supabase Edge Function (Server-side Secret Key)
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        query: sanitizedQuery,
        candidates: promptCandidates,
        locale,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[AI-Curator Edge Function] responded with ${res.status}: ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    const rawContent = json.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent);
    const matchesMap = new Map<string, string>();
    if (Array.isArray(parsed.matches)) {
      for (const m of parsed.matches) {
        if (m.id && m.reason) {
          matchesMap.set(m.id, m.reason);
        }
      }
    }

    const matchedComics: ComicSearchResult[] = [];
    for (const [id, reason] of matchesMap.entries()) {
      const found = candidateComics.find((c) => c.id === id);
      if (found) {
        matchedComics.push({
          ...found,
          matchReason: reason,
        });
      }
    }

    if (matchedComics.length > 0) {
      return {
        summary: parsed.summary || '',
        rankedComics: matchedComics,
      };
    }

    return null;
  } catch (err) {
    console.warn('[AI-Curator] Fallback to deterministic local search:', err);
    return null;
  }
}
