import { Model } from "mongoose";
import { Telemetry } from "../../telemetry/entity/telemetry.schema";
import type { SensorType } from "../../telemetry/telemetry.types";
import type { SensorAnalyticsStrategy, SensorStatSlice } from "./sensor-analytics.strategy";

/**
 * DefaultSensorStrategy — one implementation reused per sensor `type`.
 * Telemetry is queried by `type` + `receivedAt` in [from, to); see interface file for Strategy rationale.
 */
export class DefaultSensorStrategy implements SensorAnalyticsStrategy {
  constructor(
    private readonly telemetryModel: Model<Telemetry>,
    readonly sensorType: SensorType,
  ) {}

  async analyze(from: Date, to: Date): Promise<SensorStatSlice> {
    const rows = await this.telemetryModel
      .aggregate<{ avg: number | null; min: number | null; max: number | null }>([
        {
          $match: {
            type: this.sensorType,
            receivedAt: { $gte: from, $lt: to },
            numericValue: { $exists: true, $ne: null, $type: ["double", "int", "long", "decimal"] },
          },
        },
        {
          $group: {
            _id: null,
            avg: { $avg: "$numericValue" },
            min: { $min: "$numericValue" },
            max: { $max: "$numericValue" },
          },
        },
      ])
      .exec();

    const row = rows[0];
    if (!row || row.avg == null) {
      return { avg: null, min: null, max: null };
    }
    return {
      avg: round1(row.avg),
      min: row.min != null ? round1(row.min) : null,
      max: row.max != null ? round1(row.max) : null,
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
