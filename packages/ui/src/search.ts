export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function findLineMatches(lines: string[], query: string): number[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const matches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.toLowerCase().includes(q)) matches.push(i + 1);
  }
  return matches;
}

export function cycleIndex(current: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return 0;
  const next = current + direction;
  if (next < 0) return length - 1;
  if (next >= length) return 0;
  return next;
}

