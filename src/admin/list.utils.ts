const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export function normalizeSearch(search?: string): string | undefined {
  const trimmed = search?.trim();
  return trimmed ? trimmed : undefined;
}

export function adminListParams(input: { limit?: number; search?: string }) {
  return {
    limit: clampLimit(input.limit),
    search: normalizeSearch(input.search),
  };
}
