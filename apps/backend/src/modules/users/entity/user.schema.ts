import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ trim: true, default: "" })
  displayName!: string;

  @Prop({ type: Object, default: () => ({}) })
  deviceSettings!: Record<string, boolean>;
}

export const UserSchema = SchemaFactory.createForClass(User);
