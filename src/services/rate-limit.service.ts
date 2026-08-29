const RATE_LIMIT_STORAGE_KEY = 'akashic_daily_rate_limit';

/**
 * Display-only counter. The enforced limit lives in the ai-curator Edge
 * Function (MAX_DAILY_PROMPTS, per hashed IP) — anything in localStorage is
 * trivially reset by the user, so it must never be the real gate.
 */
export const MAX_DAILY_PROMPTS = 30;

export interface RateLimitStatus {
  date: string;
  count: number;
  remaining: number;
  allowed: boolean;
}

export function getRateLimitStatus(): RateLimitStatus {
  const today = new Date().toISOString().split('T')[0];
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) {
      return { date: today, count: 0, remaining: MAX_DAILY_PROMPTS, allowed: true };
    }
    const data = JSON.parse(raw);
    if (data.date !== today) {
      return { date: today, count: 0, remaining: MAX_DAILY_PROMPTS, allowed: true };
    }
    const remaining = Math.max(0, MAX_DAILY_PROMPTS - (data.count || 0));
    return {
      date: today,
      count: data.count || 0,
      remaining,
      allowed: true, // Always allow search with local fallback
    };
  } catch {
    return { date: today, count: 0, remaining: MAX_DAILY_PROMPTS, allowed: true };
  }
}

export function incrementRateLimit(): RateLimitStatus {
  const current = getRateLimitStatus();
  const nextCount = (current.count || 0) + 1;
  const remaining = Math.max(0, MAX_DAILY_PROMPTS - nextCount);
  const updated: RateLimitStatus = {
    date: current.date,
    count: nextCount,
    remaining,
    allowed: true,
  };
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save rate limit to localStorage', err);
  }
  return updated;
}
