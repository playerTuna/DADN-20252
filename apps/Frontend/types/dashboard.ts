import { Feather, Ionicons } from "@expo/vector-icons";

export type DashboardNavKey = "home" | "analytics" | "devices";
export type NavKey = DashboardNavKey | "automation";
export type DeviceType = "pump" | "light";
export type ControlMode = "manually" | "auto";

export type StatItem = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export type ControlItem = {
  id: string;
  name: string;
  state: "online" | "offline";
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

export type SidebarItem = {
  key: NavKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};
