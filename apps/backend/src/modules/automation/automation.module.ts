import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { CommandModule } from '../command/command.module';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationLog, AutomationLogSchema } from './entity/automation-log.schema';
import { AutomationRuleEntity, AutomationRuleSchema } from './entity/automation-rule.schema';
import { Device, DeviceSchema } from '../users/entity/device.schema';
import { DeviceState, DeviceStateSchema } from '../users/entity/device-state.schema';
import { User, UserSchema } from '../users/entity/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: DeviceState.name, schema: DeviceStateSchema },
      { name: AutomationRuleEntity.name, schema: AutomationRuleSchema },
      { name: AutomationLog.name, schema: AutomationLogSchema },
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => CommandModule),
  ],
  providers: [AutomationService],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
