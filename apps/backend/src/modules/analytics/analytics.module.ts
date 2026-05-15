import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommandLog, CommandLogSchema } from "../command/entity/command-log.schema";
import { Alert, AlertSchema } from "../telemetry/entity/alert.schema";
import { Telemetry, TelemetrySchema } from "../telemetry/entity/telemetry.schema";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Telemetry.name, schema: TelemetrySchema },
      { name: CommandLog.name, schema: CommandLogSchema },
      { name: Alert.name, schema: AlertSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
