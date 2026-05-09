import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { User } from "./user.schema";

export type DeviceStateDocument = HydratedDocument<DeviceState>;

@Schema({ timestamps: true })
export class DeviceState {
  @Prop({ required: true, type: Types.ObjectId, ref: User.name, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  deviceKey!: string;

  @Prop({ required: true, default: false })
  autoMode!: boolean;

  @Prop({ required: true, default: false })
  power!: boolean;

  @Prop({ required: true, default: false })
  desiredPower!: boolean;

  @Prop()
  actualPower?: boolean;

  @Prop({
    type: String,
    enum: ["idle", "sent", "acked", "timeout", "failed"],
    default: "idle",
    index: true,
  })
  lastCommandStatus!: "idle" | "sent" | "acked" | "timeout" | "failed";

  @Prop({ type: Date })
  lastCommandAt?: Date;

  @Prop({ type: Date })
  lastAckAt?: Date;

  @Prop({ type: Date })
  lastSeenAt?: Date;

  @Prop({
    type: String,
    enum: ["online", "offline", "unknown"],
    default: "unknown",
    index: true,
  })
  connectionStatus!: "online" | "offline" | "unknown";
}

export const DeviceStateSchema = SchemaFactory.createForClass(DeviceState);
DeviceStateSchema.index({ userId: 1, deviceKey: 1 }, { unique: true });
