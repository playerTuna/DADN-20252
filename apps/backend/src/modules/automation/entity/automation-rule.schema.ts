import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/entity/user.schema';

export type AutomationRuleDocument = HydratedDocument<AutomationRuleEntity>;

@Schema({ _id: false })
class AutomationCondition {
  @Prop({
    required: true,
    type: String,
    enum: ['soilMoisture', 'temperature', 'light'],
  })
  sensorKey!: 'soilMoisture' | 'temperature' | 'light';

  @Prop({ required: true, type: String, enum: ['<', '>'] })
  operator!: '<' | '>';

  @Prop({ required: true })
  value!: number;
}

@Schema({ _id: false })
class AutomationSchedule {
  @Prop({ required: true })
  time!: string; // HH:mm

  @Prop({ required: true, type: String, enum: ['ON', 'OFF'] })
  action!: 'ON' | 'OFF';

  @Prop({ required: true, default: true })
  enabled!: boolean;

  @Prop({ type: [AutomationCondition], default: [] })
  conditions?: AutomationCondition[];
}

@Schema({ timestamps: true })
export class AutomationRuleEntity {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  deviceId!: string;

  @Prop({ required: true, index: true, type: String, enum: ['pump', 'fan', 'rgb'] })
  target!: 'pump' | 'fan' | 'rgb';

  @Prop({ required: true, default: false, index: true })
  enabled!: boolean;

  @Prop({ type: [AutomationCondition], default: [] })
  turnOnConditions!: AutomationCondition[];

  @Prop({ type: [AutomationCondition], default: [] })
  turnOffConditions!: AutomationCondition[];

  @Prop({ type: [AutomationSchedule], default: [] })
  schedules!: AutomationSchedule[];

  @Prop()
  onPayload?: string;

  @Prop()
  offPayload?: string;
}

export const AutomationRuleSchema = SchemaFactory.createForClass(AutomationRuleEntity);
AutomationRuleSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
