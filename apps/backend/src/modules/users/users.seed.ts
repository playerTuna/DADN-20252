import { AutomationRule } from "../automation/automation.types";

export const defaultDeviceSettings: Record<string, boolean> = {
  "pump-1": true,
  "pump-2": false,
  "led-1": true,
  "led-2": true,
  "led-3": false,
  "schedule-1": true,
  "schedule-2": true,
  "schedule-3": false,
  "dev-1": true,
  "dev-2": false,
  "dev-3": true,
  "dev-4": true,
};

export const defaultManagedDevices = [
  { id: "fan", name: "Fan", autoMode: true, power: false },
  { id: "pump", name: "Pump (Water)", autoMode: true, power: true },
  { id: "speaker", name: "Speaker", autoMode: false, power: false },
  { id: "rgb", name: "Grow Light", autoMode: false, power: false },
];

export const defaultAutomationRules: AutomationRule[] = [
  {
    deviceId: "pump",
    target: "pump",
    sensorKey: "soilMoisture",
    enabled: true,
    turnOnWhen: { operator: "<", value: 40 },
    turnOffWhen: { operator: ">", value: 70 },
    onPayload: "ON",
    offPayload: "OFF",
  },
  {
    deviceId: "fan",
    target: "fan",
    sensorKey: "temperature",
    enabled: true,
    turnOnWhen: { operator: ">", value: 32 },
    turnOffWhen: { operator: "<", value: 28 },
    onPayload: "ON",
    offPayload: "OFF",
  },
  {
    deviceId: "rgb",
    target: "rgb",
    sensorKey: "light",
    enabled: false,
    turnOnWhen: { operator: "<", value: 35 },
    turnOffWhen: { operator: ">", value: 65 },
    onPayload: "255,255,255",
    offPayload: "0,0,0",
  },
];

export const appFeatures = {
  analyticsBeta: false,
  deviceSchedules: true,
  alertPush: true,
} as const;

export const dashboardSeed = {
  home: {
    title: "Home - Dashboards",
    stats: [
      { label: "Temperature", value: "30", icon: "thermometer-outline" },
      { label: "Air Humidity", value: "40%", icon: "cloud-outline" },
      { label: "Soil Humidity", value: "36%", icon: "water-outline" },
      { label: "Light Intensity", value: "50%", icon: "sunny-outline" },
    ],
    controls: [
      { id: "pump-1", name: "Pump 1", state: "online", mode: "manually", type: "pump", enabled: true },
      { id: "pump-2", name: "Pump 2", state: "offline", mode: "auto", type: "pump", enabled: false },
      { id: "led-1", name: "Led 1", state: "online", mode: "manually", type: "light", enabled: true },
      { id: "led-2", name: "Led 2", state: "online", mode: "manually", type: "light", enabled: true },
      { id: "led-3", name: "Led 3", state: "offline", mode: "auto", type: "light", enabled: false },
    ],
    alerts: [
      { id: "h-1", text: "Pump 2 offline", time: "6:00 AM" },
      { id: "h-2", text: "Soil moisture low", time: "6:00 AM" },
      { id: "h-3", text: "Soil moisture low", time: "6:00 AM" },
      { id: "h-4", text: "Pump 2 offline", time: "6:00 AM" },
      { id: "h-5", text: "Soil moisture low", time: "6:00 AM" },
      { id: "h-6", text: "Soil moisture low", time: "6:00 AM" },
      { id: "h-7", text: "Pump 2 offline", time: "6:00 AM" },
      { id: "h-8", text: "Pump 2 offline", time: "6:00 AM" },
      { id: "h-9", text: "Led 3 auto mode enabled", time: "5:45 AM" },
      { id: "h-10", text: "Water tank level normal", time: "5:30 AM" },
    ],
  },
  analytics: {
    title: "Analytics - Dashboards",
    stats: [
      { label: "Avg Temperature", value: "27", icon: "thermometer-outline" },
      { label: "Water Usage", value: "180L", icon: "water-outline" },
      { label: "Runtime Efficiency", value: "89%", icon: "flash-outline" },
      { label: "Alerts Resolved", value: "12", icon: "checkmark-circle-outline" },
    ],
    controls: [
      { id: "schedule-1", name: "Morning Cycle", state: "online", mode: "auto", type: "pump", enabled: true },
      { id: "schedule-2", name: "Cooling Fan", state: "online", mode: "auto", type: "light", enabled: true },
      { id: "schedule-3", name: "Night Lamp", state: "offline", mode: "manually", type: "light", enabled: false },
    ],
    alerts: [
      { id: "a-1", text: "Humidity trend below target", time: "8:10 AM" },
      { id: "a-2", text: "Water consumption increased 8%", time: "7:40 AM" },
      { id: "a-3", text: "Morning cycle completed", time: "7:00 AM" },
      { id: "a-4", text: "Cooling fan entered auto mode", time: "6:30 AM" },
      { id: "a-5", text: "No anomaly detected", time: "6:00 AM" },
    ],
  },
  devices: {
    title: "Devices - Dashboards",
    stats: [
      { label: "Active Devices", value: "08", icon: "hardware-chip-outline" },
      { label: "Offline Devices", value: "02", icon: "close-circle-outline" },
      { label: "Auto Schedules", value: "05", icon: "timer-outline" },
      { label: "Power Status", value: "Good", icon: "battery-half-outline" },
    ],
    controls: [
      { id: "dev-1", name: "Pump A", state: "online", mode: "manually", type: "pump", enabled: true },
      { id: "dev-2", name: "Pump B", state: "offline", mode: "auto", type: "pump", enabled: false },
      { id: "dev-3", name: "Grow Light 1", state: "online", mode: "manually", type: "light", enabled: true },
      { id: "dev-4", name: "Grow Light 2", state: "online", mode: "manually", type: "light", enabled: true },
    ],
    alerts: [
      { id: "d-1", text: "Pump B requires inspection", time: "9:05 AM" },
      { id: "d-2", text: "Grow Light 2 synced", time: "8:20 AM" },
      { id: "d-3", text: "Device firmware up to date", time: "7:45 AM" },
      { id: "d-4", text: "Sensor Hub battery healthy", time: "7:15 AM" },
    ],
  },
};
