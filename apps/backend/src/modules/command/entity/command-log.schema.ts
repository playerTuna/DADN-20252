import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { LogicalFeedKey } from "../../mqtt/mqtt.topics";
import { User } from "../../users/entity/user.schema";

export type CommandLogDocument = HydratedDocument<CommandLog>;

@Schema({ timestamps: true })
export class CommandLog {
  @Prop({ required: true, unique: true, index: true })
  commandId!: string;

  @Prop({ required: true, index: true })
  target!: LogicalFeedKey;

  @Prop({ required: true })
  payload!: string;

  @Prop({ type: Types.ObjectId, ref: User.name, index: true })
  userId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ["manual", "automation"],
    index: true,
  })
  source?: "manual" | "automation";

  @Prop({
    required: true,
    type: String,
    enum: ["sent", "acked", "failed", "timeout"],
    default: "sent",
    index: true,
  })
  status!: "sent" | "acked" | "failed" | "timeout";

  @Prop()
  error?: string;

  @Prop()
  ackPayload?: string;

  @Prop({ index: true })
  idempotencyKey?: string;

  @Prop({ required: true, index: true })
  issuedAt!: Date;

  @Prop()
  ackedAt?: Date;
}

export const CommandLogSchema = SchemaFactory.createForClass(CommandLog);
CommandLogSchema.index({ target: 1, issuedAt: -1 });
CommandLogSchema.index({ userId: 1, issuedAt: -1 });
