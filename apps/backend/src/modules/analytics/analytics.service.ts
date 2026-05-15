import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CommandLog } from "../command/entity/command-log.schema";
import { Alert } from "../telemetry/entity/alert.schema";
import { Telemetry } from "../telemetry/entity/telemetry.schema";
import { SENSOR_TYPES, SensorType } from "../telemetry/telemetry.types";
import { DefaultSensorStrategy } from "./strategies/default-sensor.strategy";
import type { SensorAnalyticsStrategy, SensorStatSlice } from "./strategies/sensor-analytics.strategy";
import { addUtcDays, startOfUtcIsoWeek } from "./utils/utc-week";

export type WeeklySensorStat = {
  avg: number | null;
  min: number | null;
  max: number | null;
  deltaAvg: number | null;
};

export type WeeklyReportPayload = {
  period: { from: string; to: string };
  sensors: Record<SensorType, WeeklySensorStat>;
  deviceActivity: { pump: number; fan: number; speaker: number };
  alerts: Record<SensorType, number>;
};

@Injectable()
export class AnalyticsService {
  private readonly sensorStrategies: Map<SensorType, SensorAnalyticsStrategy>;

  constructor(
    @InjectModel(Telemetry.name) private readonly telemetryModel: Model<Telemetry>,
    @InjectModel(CommandLog.name) private readonly commandLogModel: Model<CommandLog>,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
  ) {
    this.sensorStrategies = new Map(
      SENSOR_TYPES.map((type) => [type, new DefaultSensorStrategy(this.telemetryModel, type)]),
    );
  }

  async getWeeklyReport(userId: string, fromParam?: string): Promise<WeeklyReportPayload> {
    const weekStart = fromParam ? new Date(fromParam) : startOfUtcIsoWeek();
    if (Number.isNaN(weekStart.getTime())) {
      throw new BadRequestException("Invalid from date");
    }
    const currentStart = weekStart;
    const currentEnd = addUtcDays(currentStart, 7);
    const prevStart = addUtcDays(currentStart, -7);
    const prevEnd = currentStart;

    const periodTo = new Date(currentEnd.getTime() - 1);

    const sensorEntries = await Promise.all(
      SENSOR_TYPES.map(async (type) => {
        const strategy = this.sensorStrategies.get(type)!;
        const [prev, curr] = await Promise.all([
          strategy.analyze(prevStart, prevEnd),
          strategy.analyze(currentStart, currentEnd),
        ]);
        return [type, this.mergeSensorStats(prev, curr)] as const;
      }),
    );

    const sensors = Object.fromEntries(sensorEntries) as Record<SensorType, WeeklySensorStat>;

    const userOid = new Types.ObjectId(userId);
    const [pump, fan, speaker] = await Promise.all([
      this.commandLogModel
        .countDocuments({
          userId: userOid,
          target: "pump",
          issuedAt: { $gte: currentStart, $lt: currentEnd },
        })
        .exec(),
      this.commandLogModel
        .countDocuments({
          userId: userOid,
          target: "fan",
          issuedAt: { $gte: currentStart, $lt: currentEnd },
        })
        .exec(),
      this.commandLogModel
        .countDocuments({
          userId: userOid,
          target: "speaker",
          issuedAt: { $gte: currentStart, $lt: currentEnd },
        })
        .exec(),
    ]);

    const alertRows = await this.alertModel
      .aggregate<{ _id: SensorType; count: number }>([
        {
          $match: {
            type: { $in: [...SENSOR_TYPES] },
            triggeredAt: { $gte: currentStart, $lt: currentEnd },
          },
        },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ])
      .exec();

    const alerts = Object.fromEntries(
      SENSOR_TYPES.map((t) => {
        const row = alertRows.find((r) => r._id === t);
        return [t, row?.count ?? 0] as const;
      }),
    ) as Record<SensorType, number>;

    return {
      period: {
        from: currentStart.toISOString(),
        to: periodTo.toISOString(),
      },
      sensors,
      deviceActivity: { pump, fan, speaker },
      alerts,
    };
  }

  private mergeSensorStats(prev: SensorStatSlice, curr: SensorStatSlice): WeeklySensorStat {
    const deltaAvg =
      curr.avg != null && prev.avg != null ? Math.round((curr.avg - prev.avg) * 10) / 10 : null;
    return {
      avg: curr.avg,
      min: curr.min,
      max: curr.max,
      deltaAvg,
    };
  }
}
