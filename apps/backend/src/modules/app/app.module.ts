import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { HealthModule } from "../health/health.module";
import { MqttModule } from "../mqtt/mqtt.module";
import { getBackendEnvFilePaths } from "../mqtt/runtime-env";
import { RealtimeModule } from "../realtime/realtime.module";
import { TelemetryModule } from "../telemetry/telemetry.module";
import { CommandModule } from "../command/command.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AutomationModule } from "../automation/automation.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getBackendEnvFilePaths(),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>("MONGODB_URI")?.trim() ||
          "mongodb://127.0.0.1:27017/yolo_farm",
      }),
    }),
    MqttModule,
    TelemetryModule,
    RealtimeModule,
    HealthModule,
    CommandModule,
    UsersModule,
    AuthModule,
    AutomationModule,
  ],
})
export class AppModule {}
