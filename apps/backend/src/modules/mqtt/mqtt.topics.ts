export type LogicalFeedKey =
  | "temp"
  | "air_humidity"
  | "soil_humidity"
  | "light"
  | "fan"
  | "pump"
  | "speaker"
  | "rgb"
  | "status"
  | "stream";

export const ALL_LOGICAL_KEYS = Object.freeze([
  "temp",
  "air_humidity",
  "soil_humidity",
  "light",
  "fan",
  "pump",
  "speaker",
  "rgb",
  "status",
  "stream",
] as const);

const LOGICAL_KEY_ALIASES: Record<string, LogicalFeedKey> = {
  "air-humidity": "air_humidity",
  "soil-humidity": "soil_humidity",
  "water-pump": "pump",
};

export const FEED_KEY_MAPPING: Record<LogicalFeedKey, [string, string]> = {
  temp: ["FEED_TEMP_KEY", "yolo-farm-temp"],
  air_humidity: ["FEED_AIR_HUMIDITY_KEY", "yolo-farm-air-humidity"],
  soil_humidity: ["FEED_SOIL_HUMIDITY_KEY", "yolo-farm-soil-humidity"],
  light: ["FEED_LIGHT_KEY", "yolo-farm-light"],
  fan: ["FEED_FAN_KEY", "yolo-farm-fan"],
  pump: ["FEED_PUMP_KEY", "yolo-farm-pump"],
  speaker: ["FEED_SPEAKER_KEY", "yolo-farm-speaker"],
  rgb: ["FEED_RGB_KEY", "yolo-farm-rgb"],
  status: ["FEED_STATUS_KEY", "yolo-farm-status"],
  stream: ["FEED_STREAM_KEY", "yolo-farm-stream"],
};

export const getFeedKey = (logicalKey: LogicalFeedKey): string => {
  const [envVarName, defaultValue] = FEED_KEY_MAPPING[logicalKey];
  return (process.env[envVarName] ?? defaultValue).trim();
};

export function getAdafruitFeedTopic(key: LogicalFeedKey): string {
  const username = process.env.ADAFRUIT_IO_USERNAME ?? "";
  const feedKey = getFeedKey(key);
  return `${username}/feeds/${feedKey}`;
}

export function getSubscribeKeys(): LogicalFeedKey[] {
  const raw = process.env.SUBSCRIBE_FEEDS ?? "";
  if (!raw) return [...ALL_LOGICAL_KEYS];

  const keysFromEnv = new Set(
    raw
      .split(",")
      .map((s) => normalizeLogicalKey(s))
      .filter((value): value is LogicalFeedKey => value !== null),
  );
  return ALL_LOGICAL_KEYS.filter((k) => keysFromEnv.has(k));
}

export function normalizeLogicalKey(value: string): LogicalFeedKey | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const normalized = LOGICAL_KEY_ALIASES[trimmed] ?? trimmed;
  return (ALL_LOGICAL_KEYS as readonly string[]).includes(normalized)
    ? (normalized as LogicalFeedKey)
    : null;
}
