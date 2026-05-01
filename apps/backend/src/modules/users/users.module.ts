import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AutomationRuleEntity, AutomationRuleSchema } from "../automation/entity/automation-rule.schema";
import { AutomationLog, AutomationLogSchema } from "../automation/entity/automation-log.schema";
import { CommandLog, CommandLogSchema } from "../command/entity/command-log.schema";
import { Alert, AlertSchema } from "../telemetry/entity/alert.schema";
import { Telemetry, TelemetrySchema } from "../telemetry/entity/telemetry.schema";
import { Device, DeviceSchema } from "./entity/device.schema";
import { DeviceState, DeviceStateSchema } from "./entity/device-state.schema";
import { User, UserSchema } from "./entity/user.schema";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: DeviceState.name, schema: DeviceStateSchema },
      { name: AutomationRuleEntity.name, schema: AutomationRuleSchema },
      { name: AutomationLog.name, schema: AutomationLogSchema },
      { name: Telemetry.name, schema: TelemetrySchema },
      { name: Alert.name, schema: AlertSchema },
      { name: CommandLog.name, schema: CommandLogSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}

