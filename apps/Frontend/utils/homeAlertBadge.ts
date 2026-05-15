let cachedHomeAlertCount = 0;

export function setHomeAlertCount(count: number) {
  cachedHomeAlertCount = Math.max(0, count);
}

export function getHomeAlertCount() {
  return cachedHomeAlertCount;
}

export function formatAlertBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}
