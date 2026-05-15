export type AutomationSensorKey = 'soilMoisture' | 'temperature' | 'light';

export type AutomationTarget = 'pump' | 'fan' | 'rgb';

export type AutomationThreshold = {
  operator: '<' | '>';
  value: number;
};

export type AutomationCondition = {
  sensorKey: AutomationSensorKey;
  operator: '<' | '>';
  value: number;
};

export type AutomationSchedule = {
  time: string; // HH:mm
  action: 'ON' | 'OFF';
  enabled: boolean;
  conditions?: AutomationCondition[];
};

export type AutomationRule = {
  deviceId: string;
  target: AutomationTarget;
  enabled: boolean;
  turnOnConditions: AutomationCondition[];
  turnOffConditions: AutomationCondition[];
  schedules: AutomationSchedule[];
  onPayload?: string;
  offPayload?: string;
};

export type AutomationLogEntry = {
  id: string;
  deviceId: string;
  target: AutomationTarget;
  sensorKey?: AutomationSensorKey;
  sensorValue?: number;
  action: 'ON' | 'OFF';
  payload: string;
  reason: string;
  status: 'sent' | 'failed';
  createdAt: Date;
  commandId?: string;
  error?: string;
};
