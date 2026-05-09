import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { User } from "../../users/entity/user.schema";

export type AutomationRuleDocument = HydratedDocument<AutomationRuleEntity>;

@Schema({ _id: false })
class ThresholdValue {
  @Prop({ required: true, type: String, enum: ["<", ">"] })
  operator!: "<" | ">";

  @Prop({ required: true })
  value!: number;
}

@Schema({ timestamps: true })
export class AutomationRuleEntity {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  deviceId!: string;

  @Prop({ required: true, index: true })
  target!: string;

  @Prop({
    required: true,
    type: String,
    enum: ["soilMoisture", "temperature", "light"],
    index: true,
  })
  sensorKey!: "soilMoisture" | "temperature" | "light";

  @Prop({ required: true, default: false, index: true })
  enabled!: boolean;

  @Prop({ required: true, type: ThresholdValue })
  turnOnWhen!: ThresholdValue;

  @Prop({ required: true, type: ThresholdValue })
  turnOffWhen!: ThresholdValue;

  @Prop()
  onPayload?: string;

  @Prop()
  offPayload?: string;
}

export const AutomationRuleSchema =
  SchemaFactory.createForClass(AutomationRuleEntity);
AutomationRuleSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
