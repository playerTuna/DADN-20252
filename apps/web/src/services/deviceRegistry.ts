export type DevicePowerValue = 'ON' | 'OFF';

export type ManagedDeviceId = 'fan' | 'pump' | 'speaker' | 'rgb';

const MANAGED_DEVICE_COMMAND_PATH: Record<ManagedDeviceId, string> = {
  fan: '/commands/fan',
  pump: '/commands/pump',
  speaker: '/commands/speaker',
  rgb: '/commands/rgb',
};

export function getManagedDeviceCommandPath(deviceId: string): string | null {
  return MANAGED_DEVICE_COMMAND_PATH[deviceId as ManagedDeviceId] ?? null;
}

export function buildManagedDevicePowerRequest(
  deviceId: string,
  value: DevicePowerValue
): { path: string; body: unknown } | null {
  const path = getManagedDeviceCommandPath(deviceId);
  if (!path) return null;

  if (deviceId === 'rgb') {
    const isOn = value === 'ON';
    return {
      path,
      body: {
        r: isOn ? 255 : 0,
        g: isOn ? 255 : 0,
        b: isOn ? 255 : 0,
        format: 'csv',
      },
    };
  }

  return {
    path,
    body: { value },
  };
}
