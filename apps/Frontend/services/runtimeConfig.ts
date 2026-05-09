function readPublicEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  return process.env[key];
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

export function getApiBaseUrl(): string {
  return (
    readPublicEnv("EXPO_PUBLIC_API_URL") ??
    readPublicEnv("EXPO_PUBLIC_API_BASE_URL") ??
    "http://localhost:3001"
  );
}

export function shouldUseMocks(): boolean {
  return isTruthy(readPublicEnv("EXPO_PUBLIC_USE_MOCKS"));
}
