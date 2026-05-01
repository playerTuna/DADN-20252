import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { User } from "../../users/entity/user.schema";

export type AutomationLogDocument = HydratedDocument<AutomationLog>;

@Schema({ timestamps: false })
export class AutomationLog {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  logId!: string;

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

  @Prop({ required: true })
  sensorValue!: number;

  @Prop({ required: true, type: String, enum: ["ON", "OFF"] })
  action!: "ON" | "OFF";

  @Prop({ required: true })
  payload!: string;

  @Prop({ required: true })
  reason!: string;

  @Prop({ required: true, type: String, enum: ["sent", "failed"], index: true })
  status!: "sent" | "failed";

  @Prop({ required: true, index: true })
  createdAt!: Date;

  @Prop()
  commandId?: string;

  @Prop()
  error?: string;
}

export const AutomationLogSchema = SchemaFactory.createForClass(AutomationLog);
AutomationLogSchema.index({ userId: 1, createdAt: -1 });
