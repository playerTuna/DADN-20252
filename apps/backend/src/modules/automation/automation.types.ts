export type AutomationSensorKey = "soilMoisture" | "temperature" | "light";

export type AutomationTarget = "pump" | "fan" | "rgb";

export type AutomationThreshold = {
  operator: "<" | ">";
  value: number;
};

export type AutomationRule = {
  deviceId: string;
  target: AutomationTarget;
  sensorKey: AutomationSensorKey;
  enabled: boolean;
  turnOnWhen: AutomationThreshold;
  turnOffWhen: AutomationThreshold;
  onPayload?: string;
  offPayload?: string;
};

export type AutomationLogEntry = {
  id: string;
  deviceId: string;
  target: AutomationTarget;
  sensorKey: AutomationSensorKey;
  sensorValue: number;
  action: "ON" | "OFF";
  payload: string;
  reason: string;
  status: "sent" | "failed";
  createdAt: Date;
  commandId?: string;
  error?: string;
};
