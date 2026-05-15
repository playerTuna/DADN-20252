export type NavKey = 'home' | 'analytics' | 'devices';
export type DeviceType = 'pump' | 'light';
export type ControlMode = 'manually' | 'auto';

export type StatItem = {
  label: string;
  value: string;
  icon: string;
};

export type ControlItem = {
  id: string;
  name: string;
  state: 'online' | 'offline';
  mode: ControlMode;
  type: DeviceType;
  enabled: boolean;
};

export type AlertItem = {
  id: string;
  text: string;
  time: string;
  level?: 'low' | 'high';
  sensorLabel?: string;
};

export type DashboardData = {
  title: string;
  stats: StatItem[];
  controls: ControlItem[];
  alerts: AlertItem[];
};
