export type DevicePowerValue = "ON" | "OFF";

export type ManagedDeviceId = "fan" | "pump" | "speaker" | "rgb";

export type DashboardControlCommandTarget = ManagedDeviceId | "rgb";

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const MANAGED_DEVICE_COMMAND_PATH: Record<ManagedDeviceId, string> = {
  fan: "/commands/fan",
  pump: "/commands/pump",
  speaker: "/commands/speaker",
  rgb: "/commands/rgb",
};

const DASHBOARD_CONTROL_TARGETS: Record<string, DashboardControlCommandTarget> = {
  "pump-1": "pump",
  "pump-2": "pump",
  "schedule-1": "pump",
  "dev-1": "pump",
  "dev-2": "pump",
  "schedule-2": "fan",
  "led-1": "rgb",
  "led-2": "rgb",
  "led-3": "rgb",
  "schedule-3": "rgb",
  "dev-3": "rgb",
  "dev-4": "rgb",
};

const RGB_CONTROL_COLORS: Record<string, RgbColor> = {
  "led-1": { r: 255, g: 0, b: 0 },
  "led-2": { r: 0, g: 255, b: 0 },
  "led-3": { r: 0, g: 0, b: 255 },
  "schedule-3": { r: 200, g: 200, b: 255 },
  "dev-3": { r: 255, g: 255, b: 0 },
  "dev-4": { r: 255, g: 128, b: 0 },
};

export const DASHBOARD_MODE_UNWIRED_REASON =
  "Auto/manually mode on dashboard controls is not wired to backend or device ack yet.";

export function getManagedDeviceCommandPath(deviceId: string): string | null {
  return MANAGED_DEVICE_COMMAND_PATH[deviceId as ManagedDeviceId] ?? null;
}

export function buildManagedDevicePowerRequest(
  deviceId: string,
  value: DevicePowerValue,
): { path: string; body: unknown } | null {
  const path = getManagedDeviceCommandPath(deviceId);
  if (!path) return null;

  if (deviceId === "rgb") {
    const isOn = value === "ON";
    return {
      path,
      body: {
        r: isOn ? 255 : 0,
        g: isOn ? 255 : 0,
        b: isOn ? 255 : 0,
        format: "csv",
      },
    };
  }

  return {
    path,
    body: { value },
  };
}

export function getDashboardControlTarget(
  controlId: string,
): DashboardControlCommandTarget | null {
  return DASHBOARD_CONTROL_TARGETS[controlId] ?? null;
}

export function getDashboardControlRgbColor(controlId: string): RgbColor | null {
  return RGB_CONTROL_COLORS[controlId] ?? null;
}

export function listDashboardControlIdsByTarget(
  target: DashboardControlCommandTarget,
): string[] {
  return Object.entries(DASHBOARD_CONTROL_TARGETS)
    .filter(([, currentTarget]) => currentTarget === target)
    .map(([controlId]) => controlId);
}
