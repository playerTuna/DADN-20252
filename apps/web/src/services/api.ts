import type { AlertItem, DashboardData, NavKey, StatItem } from '../types/dashboard';
import { apiFetch } from './auth';
import { buildManagedDevicePowerRequest, type DevicePowerValue } from './deviceRegistry';
import { getApiBaseUrl } from './runtimeConfig';

type DeviceSettings = Record<string, boolean>;
type TelemetryType = 'temp' | 'air_humidity' | 'soil_humidity' | 'light';

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
  temp: 'Temperature',
  air_humidity: 'Air Humidity',
  soil_humidity: 'Soil Humidity',
  light: 'Light Intensity',
};

const QUICK_STAT_ICON: Record<TelemetryType, StatItem['icon']> = {
  temp: 'thermometer',
  air_humidity: 'cloud',
  soil_humidity: 'drop',
  light: 'sun',
};

export type TelemetryPoint = {
  id: string;
  numericValue: number;
  receivedAt: string;
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

export type AutomationThreshold = {
  operator: '<' | '>';
  value: number;
};

export type AutomationRule = {
  deviceId: string;
  target: 'pump' | 'fan' | 'rgb';
  sensorKey: AutomationSensorKey;
  enabled: boolean;
  turnOnWhen: AutomationThreshold;
  turnOffWhen: AutomationThreshold;
  onPayload?: string;
  offPayload?: string;
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
    return '-';
  }
  const n = Math.round(doc.numericValue);
  if (type === 'temp') return String(n);
  return `${n}%`;
}

export async function getDashboard(): Promise<Record<NavKey, DashboardData>> {
  return apiGet<Record<NavKey, DashboardData>>('/dashboard');
}

export async function getUser(): Promise<UserProfile> {
  return apiGet<UserProfile>('/me');
}

export async function getSettings(): Promise<DeviceSettings> {
  return apiGet<DeviceSettings>('/settings');
}

export async function updateUserSettings(
  payload: Partial<EditableSettings>
): Promise<EditableSettings> {
  return apiPatch<EditableSettings>('/settings', sanitizeSettingsPatch(payload));
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
  }));
}
