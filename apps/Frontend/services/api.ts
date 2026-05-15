import type { AlertItem, DashboardData, DashboardNavKey, NavKey, StatItem } from '../types/dashboard';
import { apiFetch } from './auth';
import { buildManagedDevicePowerRequest, type DevicePowerValue } from './deviceRegistry';
import { isSensorTelemetryType, type TelemetryRealtimeEvent } from './realtime';
import { getApiBaseUrl } from './runtimeConfig';

export type { TelemetryRealtimeEvent } from './realtime';

type DeviceSettings = Record<string, boolean>;
export type TelemetryType = 'temp' | 'air_humidity' | 'soil_humidity' | 'light';

export type UserProfile = {
  displayName: string;
  email?: string;
  id?: string;
};

export type EditableSettings = DeviceSettings;

type LatestTelemetry = {
  _id: string;
  type: TelemetryType;
  numericValue?: number;
  raw: string;
  receivedAt: string;
};

type AlertDto = {
  _id: string;
  type: TelemetryType;
  level: 'low' | 'high';
  value: number;
  triggeredAt: string;
};

const QUICK_STAT_SENSOR_LABEL: Record<TelemetryType, string> = {
  temp: 'Nhiệt độ',
  air_humidity: 'Độ ẩm không khí',
  soil_humidity: 'Độ ẩm đất',
  light: 'Cường độ ánh sáng',
};

const QUICK_STAT_ICON: Record<TelemetryType, StatItem['icon']> = {
  temp: 'thermometer-outline',
  air_humidity: 'cloud-outline',
  soil_humidity: 'water-outline',
  light: 'sunny-outline',
};

export type TelemetryPoint = {
  id: string;
  numericValue: number;
  receivedAt: string;
};

export type WeeklyReportSensorKey = 'temp' | 'air_humidity' | 'soil_humidity' | 'light';

export type WeeklySensorStat = {
  avg: number | null;
  min: number | null;
  max: number | null;
  deltaAvg: number | null;
};

export type WeeklyReportPayload = {
  period: { from: string; to: string };
  sensors: Record<WeeklyReportSensorKey, WeeklySensorStat>;
  deviceActivity: { pump: number; fan: number; speaker: number };
  alerts: Record<WeeklyReportSensorKey, number>;
};

export type ManagedDevice = {
  id: string;
  name: string;
  autoMode: boolean;
  power: boolean;
  desiredPower: boolean;
  actualPower: boolean | null;
  lastCommandStatus: 'idle' | 'sent' | 'acked' | 'timeout' | 'failed';
  lastCommandAt: string | null;
  lastAckAt: string | null;
  lastSeenAt: string | null;
  connectionStatus: 'online' | 'offline' | 'unknown';
};

export type AutomationSensorKey = 'soilMoisture' | 'temperature' | 'light';

export type AutomationCondition = {
  sensorKey: AutomationSensorKey;
  operator: '<' | '>';
  value: number;
};

export type AutomationThreshold = {
  operator: '<' | '>';
  value: number;
};

export type AutomationSchedule = {
  time: string;
  action: 'ON' | 'OFF';
  enabled: boolean;
};

export type AutomationRule = {
  deviceId: string;
  target: 'pump' | 'fan' | 'rgb';
  enabled: boolean;
  turnOnConditions: AutomationCondition[];
  turnOffConditions: AutomationCondition[];
  schedules: AutomationSchedule[];
  onPayload?: string;
  offPayload?: string;
};

export type AutomationLog = {
  id?: string;
  _id?: string;
  deviceId: string;
  target: 'pump' | 'fan' | 'rgb';
  sensorKey: AutomationSensorKey;
  sensorValue?: number;
  action?: 'ON' | 'OFF';
  payload?: string;
  reason?: string;
  status?: 'sent' | 'failed' | 'acked' | 'timeout';
  createdAt?: string;
  commandId?: string;
  error?: string;
};

export type AppFeatures = {
  analyticsBeta: boolean;
  deviceSchedules: boolean;
  alertPush: boolean;
};

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const url = new URL(path.replace(/^\//, ''), getApiBaseUrl().replace(/\/$/, '') + '/');
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value != null) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function apiGet<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const url = buildUrl(path, query);
  const res = await apiFetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} failed with status ${res.status}`);
  }
  return parseJson<T>(res);
}

async function apiPost<T>(
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const url = buildUrl(path);
  const res = await apiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(extraHeaders ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${url} failed with status ${res.status}`);
  }
  return parseJson<T>(res);
}

async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const url = buildUrl(path);
  const res = await apiFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH ${url} failed with status ${res.status}`);
  }
  return parseJson<T>(res);
}

function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function alertText(type: TelemetryType, level: 'low' | 'high', value: number): string {
  const label = QUICK_STAT_SENSOR_LABEL[type];
  return `${label} ${level} (${value})`;
}

function sanitizeSettingsPatch(payload: Partial<EditableSettings>): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(payload).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
    )
  );
}

async function getLatestTelemetry(type: TelemetryType): Promise<LatestTelemetry | null> {
  try {
    return await apiGet<LatestTelemetry | null>('/telemetry/latest', { type });
  } catch {
    return null;
  }
}

function formatQuickStatValue(type: TelemetryType, doc: LatestTelemetry | null): string {
  if (!doc || typeof doc.numericValue !== 'number' || !Number.isFinite(doc.numericValue)) {
    return '—';
  }
  const n = Math.round(doc.numericValue);
  if (type === 'temp') return String(n);
  return `${n}%`;
}

export function mergeStatItemsFromTelemetry(
  stats: StatItem[],
  event: TelemetryRealtimeEvent
): StatItem[] {
  if (!isSensorTelemetryType(event.type)) {
    return stats;
  }

  const label = QUICK_STAT_SENSOR_LABEL[event.type];
  const value = formatQuickStatValue(event.type, {
    _id: '',
    type: event.type,
    numericValue: event.numericValue,
    raw: event.raw,
    receivedAt: event.receivedAt,
  });

  const hasLabel = stats.some((item) => item.label === label);
  if (!hasLabel) {
    return [
      ...stats,
      {
        label,
        value,
        icon: QUICK_STAT_ICON[event.type],
      },
    ];
  }

  return stats.map((item) => (item.label === label ? { ...item, value } : item));
}

export async function getDashboard(): Promise<Record<DashboardNavKey, DashboardData>> {
  return apiGet<Record<DashboardNavKey, DashboardData>>('/dashboard');
}

export async function getUser(): Promise<UserProfile> {
  return apiGet<UserProfile>('/me');
}

export async function updateUserProfile(
  payload: Pick<UserProfile, 'displayName'>
): Promise<UserProfile> {
  return apiPatch<UserProfile>('/me', payload);
}

export async function getFeatures(): Promise<AppFeatures> {
  return apiGet<AppFeatures>('/features');
}

export async function getSettings(): Promise<DeviceSettings> {
  return apiGet<DeviceSettings>('/settings');
}

export async function updateUserSettings(
  payload: Partial<EditableSettings>
): Promise<EditableSettings> {
  return apiPatch<EditableSettings>('/settings', sanitizeSettingsPatch(payload));
}

export async function updateSetting(key: string, value: boolean): Promise<boolean> {
  await updateUserSettings({ [key]: value });
  return value;
}

export async function getManagedDevices(): Promise<ManagedDevice[]> {
  return apiGet<ManagedDevice[]>('/devices');
}

export async function updateManagedDevicePower(
  id: string,
  value: DevicePowerValue
): Promise<boolean> {
  const request = buildManagedDevicePowerRequest(id, value);
  if (!request) {
    throw new Error(`No device power endpoint configured for ${id}`);
  }

  await apiPost(request.path, request.body);
  return value === 'ON';
}

export async function toggleManagedDeviceAutoMode(id: string): Promise<ManagedDevice[]> {
  return apiPatch<ManagedDevice[]>('/devices/auto-mode', { id });
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
  return apiGet<AutomationRule[]>('/automation/rules');
}

export async function updateAutomationRule(
  deviceId: string,
  payload: Partial<AutomationRule>
): Promise<AutomationRule[]> {
  return apiPatch<AutomationRule[]>(`/automation/rules/${deviceId}`, payload);
}

export async function getAutomationLogs(): Promise<AutomationLog[]> {
  return apiGet<AutomationLog[]>('/automation/logs');
}

export async function getWeeklyReport(from?: string): Promise<WeeklyReportPayload> {
  return apiGet<WeeklyReportPayload>('/analytics/weekly-report', from ? { from } : undefined);
}

export async function getTelemetryHistory(
  type?: TelemetryType,
  from?: string,
  to?: string
): Promise<TelemetryPoint[]> {
  const rows = await apiGet<
    {
      _id: string;
      numericValue?: number;
      receivedAt: string;
    }[]
  >('/telemetry', {
    type,
    from,
    to,
  });

  return rows
    .filter((row) => typeof row.numericValue === 'number')
    .map((row) => ({
      id: row._id,
      numericValue: row.numericValue as number,
      receivedAt: row.receivedAt,
    }));
}

/** Alias để analytics cũ vẫn chạy nếu còn import tên cũ */
export const getTelemetrySeries = getTelemetryHistory;

export async function getQuickStatsLive(): Promise<StatItem[]> {
  const sensorTypes: TelemetryType[] = ['temp', 'air_humidity', 'soil_humidity', 'light'];
  const docs = await Promise.all(sensorTypes.map((type) => getLatestTelemetry(type)));

  return sensorTypes.map((type, i) => ({
    label: QUICK_STAT_SENSOR_LABEL[type],
    value: formatQuickStatValue(type, docs[i]),
    icon: QUICK_STAT_ICON[type],
  }));
}

export async function getAlertsLive(limit = 40): Promise<AlertItem[]> {
  const rows = await apiGet<AlertDto[]>('/alerts');
  return rows.slice(0, limit).map((row) => ({
    id: row._id,
    text: alertText(row.type, row.level, row.value),
    time: formatTimeLabel(row.triggeredAt),
    level: row.level,
    sensorLabel: QUICK_STAT_SENSOR_LABEL[row.type],
  }));
}
