import { forwardRef, Module } from "@nestjs/common";
import { TelemetryModule } from "../telemetry/telemetry.module";
import { MqttService } from "./mqtt.service";
import { CommandModule } from "../command/command.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    forwardRef(() => TelemetryModule),
    forwardRef(() => CommandModule),
    UsersModule,
  ],
  controllers: [],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
