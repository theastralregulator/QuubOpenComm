export function formatBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

export function hasVisibleBadge(count: number): boolean {
  return Number.isFinite(count) && count > 0;
}
