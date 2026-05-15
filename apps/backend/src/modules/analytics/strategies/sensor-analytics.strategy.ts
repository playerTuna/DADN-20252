import type { SensorType } from "../../telemetry/telemetry.types";

export type SensorStatSlice = {
  avg: number | null;
  min: number | null;
  max: number | null;
};

export interface SensorAnalyticsStrategy {
  readonly sensorType: SensorType;
  analyze(from: Date, to: Date): Promise<SensorStatSlice>;
}
