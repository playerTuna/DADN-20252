import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ timestamps: true })
export class Device {
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    required: true,
    type: String,
    enum: ["fan", "pump", "speaker", "light"],
  })
  type!: "fan" | "pump" | "speaker" | "light";

  @Prop({ required: true, index: true })
  target!: string;

  @Prop({ required: true, default: false })
  defaultAutoMode!: boolean;

  @Prop({ required: true, default: false })
  defaultPower!: boolean;

  @Prop({ required: true, default: true, index: true })
  isActive!: boolean;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
