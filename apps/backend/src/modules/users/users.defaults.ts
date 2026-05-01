import { ControllableDeviceKey } from "../command/dto/command.dto";
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

export const defaultManagedDevices: Array<{
  key: ControllableDeviceKey;
  name: string;
  type: "fan" | "pump" | "speaker" | "light";
  target: ControllableDeviceKey;
  defaultAutoMode: boolean;
  defaultPower: boolean;
}> = [
  {
    key: "fan",
    name: "Fan",
    type: "fan",
    target: "fan",
    defaultAutoMode: true,
    defaultPower: false,
  },
  {
    key: "pump",
    name: "Pump (Water)",
    type: "pump",
    target: "pump",
    defaultAutoMode: true,
    defaultPower: true,
  },
  {
    key: "speaker",
    name: "Speaker",
    type: "speaker",
    target: "speaker",
    defaultAutoMode: false,
    defaultPower: false,
  },
  {
    key: "rgb",
    name: "Grow Light",
    type: "light",
    target: "rgb",
    defaultAutoMode: false,
    defaultPower: false,
  },
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
