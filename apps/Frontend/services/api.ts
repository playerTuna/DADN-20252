import type { AlertItem, DashboardData, NavKey, StatItem } from '../types/dashboard';
import { apiFetch } from './auth';
import { buildManagedDevicePowerRequest, type DevicePowerValue } from './deviceRegistry';

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

export type AutomationLog = {
  id: string;
  deviceId: string;
  target: 'pump' | 'fan' | 'rgb';
  sensorKey: AutomationSensorKey;
  sensorValue: number;
  action: 'ON' | 'OFF';
  payload: string;
  reason: string;
  status: 'sent' | 'failed';
  createdAt: string;
  commandId?: string;
  error?: string;
};

export type AppFeatures = {
  analyticsBeta: boolean;
  deviceSchedules: boolean;
  alertPush: boolean;
};

function asJsonInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { method: 'GET' });
  return (await response.json()) as T;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(
    path,
    asJsonInit({
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
  return (await response.json()) as T;
}

async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(
    path,
    asJsonInit({
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
  return (await response.json()) as T;
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

export async function getDashboard(): Promise<Record<NavKey, DashboardData>> {
  return apiGet<Record<NavKey, DashboardData>>('/dashboard');
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

export async function getTelemetryHistory(
  type?: TelemetryType,
  from?: string,
  to?: string
): Promise<TelemetryPoint[]> {
  const search = new URLSearchParams();
  if (type) search.set('type', type);
  if (from) search.set('from', from);
  if (to) search.set('to', to);

  const path = search.size ? `/telemetry?${search.toString()}` : '/telemetry';
  const rows = await apiGet<
    {
      _id: string;
      numericValue?: number;
      receivedAt: string;
    }[]
  >(path);

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

  const rows = await Promise.all(
    sensorTypes.map(async (type) => {
      const row = await apiGet<LatestTelemetry | null>(`/telemetry/latest?type=${type}`);
      return { type, row };
    })
  );

  return rows.map(({ type, row }) => ({
    label: QUICK_STAT_SENSOR_LABEL[type],
    value:
      type === 'temp'
        ? `${row?.numericValue ?? 0}`
        : `${row?.numericValue ?? 0}${type === 'light' ? '%' : '%'}`,
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
