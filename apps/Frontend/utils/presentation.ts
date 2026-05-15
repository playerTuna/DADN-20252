export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Chưa có hoạt động';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Chưa có hoạt động';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

export const STAT_LABEL_VI: Record<string, string> = {
  Temperature: 'Nhiệt độ',
  'Air Humidity': 'Độ ẩm không khí',
  'Soil Humidity': 'Độ ẩm đất',
  'Light Intensity': 'Cường độ ánh sáng',
};

export const STAT_LABEL_UNITS: Record<string, string> = {
  Temperature: '°C',
  'Air Humidity': '%',
  'Soil Humidity': '%',
  'Light Intensity': 'lx',
  'Nhiệt độ': '°C',
  'Độ ẩm không khí': '%',
  'Độ ẩm đất': '%',
  'Cường độ ánh sáng': 'lx',
};

export function translateStatLabel(label: string): string {
  return STAT_LABEL_VI[label] ?? label;
}

export function getStatUnit(label: string): string | undefined {
  return STAT_LABEL_UNITS[label] ?? STAT_LABEL_UNITS[translateStatLabel(label)];
}

export function isStatValueEmpty(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || trimmed === '-' || trimmed === '—' || trimmed.toLowerCase() === 'no data';
}

export function formatStatPlaceholder(label: string): string {
  const unit = getStatUnit(label);
  if (unit === '°C') return '—°C';
  if (unit === '%') return '—%';
  if (unit === 'lx') return '— lx';
  return '—';
}

export function formatStatValueParts(
  label: string,
  value: string
): { main: string; unit: string } | null {
  if (isStatValueEmpty(value)) return null;
  const unit = getStatUnit(label);
  if (!unit) return { main: value, unit: '' };
  if (value.includes(unit) || value.includes('%') || value.includes('°')) {
    if (unit === '°C' && value.includes('°')) {
      return { main: value.replace(/°C/i, '').trim(), unit: '°C' };
    }
    if (value.includes(unit)) {
      return { main: value.replace(unit, '').trim(), unit };
    }
    return { main: value, unit: '' };
  }
  return { main: value.trim(), unit: unit === '°C' ? '°C' : unit };
}

export function formatStatDisplayValue(label: string, value: string): string {
  const parts = formatStatValueParts(label, value);
  if (!parts) return '';
  if (!parts.unit) return parts.main;
  return parts.unit === '°C' ? `${parts.main}°C` : `${parts.main} ${parts.unit}`;
}

export type AlertSeverity = 'high' | 'low' | 'normal';

export function resolveAlertSeverity(level?: 'low' | 'high'): AlertSeverity {
  if (level === 'high') return 'high';
  if (level === 'low') return 'low';
  return 'normal';
}

export function formatAlertLevelLabel(level?: 'low' | 'high'): string {
  if (level === 'high') return 'CAO';
  if (level === 'low') return 'THẤP';
  return 'BÌNH THƯỜNG';
}

export const ALERT_SEVERITY_COLORS = {
  high: { accent: '#dc2626', bg: '#fef2f2' },
  low: { accent: '#ca8a04', bg: '#fefce8' },
  normal: { accent: '#16a34a', bg: '#f0fdf4' },
} as const;

export function translateConnectionStatus(status: 'online' | 'offline' | 'unknown'): string {
  if (status === 'online') return 'Trực tuyến';
  if (status === 'offline') return 'Ngoại tuyến';
  return 'Không xác định';
}

export function translateDeviceMode(mode: 'auto' | 'manually'): string {
  return mode === 'auto' ? 'Tự động' : 'Thủ công';
}

export function translatePowerState(on: boolean): string {
  return on ? 'Bật' : 'Tắt';
}
