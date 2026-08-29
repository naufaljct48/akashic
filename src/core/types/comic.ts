export type ComicType = 'MANGA' | 'MANHWA' | 'MANHUA';
export type ComicStatus = 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
export type ComicFormat = 'MANGA' | 'ONE_SHOT' | 'NOVEL';

export interface Comic {
  id: string;
  source_id: number;
  id_mal: number | null;
  slug: string;
  title_romaji: string;
  title_english: string | null;
  title_native: string | null;
  synonyms: string[];
  type: ComicType;
  format: ComicFormat;
  status: ComicStatus;
  synopsis: string | null;
  genres: string[];
  tags: string[];
  total_chapters: number | null;
  release_year: number | null;
  average_score: number | null; // 0 - 100
  popularity: number | null;
  cover_image_url: string | null;
  banner_image_url: string | null;
  country_of_origin: string; // JP, KR, CN
  site_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ComicSearchResult extends Comic {
  similarity?: number;
  matchReason?: string;
  /** Set when the title was retrieved via AniList's character index. */
  matchedCharacter?: string;
}

export interface ComicFilterParams {
  query?: string;
  type?: ComicType | 'ALL';
  status?: ComicStatus | 'ALL';
  genres?: string[];
  /** Real AniList tag names — resolve pill labels with resolveTropeFilters first. */
  tags?: string[];
  /** Drops rows carrying any of these genres (backs the "No Romance" pill). */
  excludeGenres?: string[];
  minScore?: number;
  sortBy?: 'popularity' | 'score' | 'year' | 'similarity';
  page?: number;
  limit?: number;
}
