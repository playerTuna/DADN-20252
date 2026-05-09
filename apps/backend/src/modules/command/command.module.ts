import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MqttModule } from "../mqtt/mqtt.module";
import { UsersModule } from "../users/users.module";
import { CommandLog, CommandLogSchema } from "./entity/command-log.schema";
import { CommandLogService } from "./command-log.service";
import { CommandsController } from "./commands.controller";
import { CommandService } from "./command.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommandLog.name, schema: CommandLogSchema },
    ]),
    forwardRef(() => MqttModule),
    UsersModule,
  ],
  controllers: [CommandsController],
  providers: [CommandLogService, CommandService],
  exports: [CommandLogService, CommandService],
})
export class CommandModule {}
