import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommandLog } from './entity/command-log.schema';
import { LogicalFeedKey } from '../mqtt/mqtt.topics';

@Injectable()
export class CommandLogService {
  constructor(
    @InjectModel(CommandLog.name)
    private readonly commandLogModel: Model<CommandLog>
  ) {}

  async createSent(params: {
    commandId: string;
    target: LogicalFeedKey;
    payload: string;
    issuedAt: Date;
    idempotencyKey?: string;
    userId?: string;
    source?: "manual" | "automation";
  }) {
    return this.commandLogModel.create({
      commandId: params.commandId,
      target: params.target,
      payload: params.payload,
      userId: params.userId ? new Types.ObjectId(params.userId) : undefined,
      source: params.source,
      status: 'sent',
      issuedAt: params.issuedAt,
      idempotencyKey: params.idempotencyKey,
    });
  }

  async markFailed(commandId: string, error: string) {
    await this.commandLogModel
      .updateOne(
        { commandId },
        {
          $set: {
            status: 'failed',
            error,
          },
        }
      )
      .exec();
  }

  async markAcked(commandId: string, ackPayload: string, ackedAt: Date) {
    const res = await this.commandLogModel
      .findOneAndUpdate(
        { commandId },
        {
          $set: {
            status: 'acked',
            ackPayload,
            ackedAt,
          },
        },
        { new: true }
      )
      .lean()
      .exec();
    return res;
  }

  async markTimedOut(commandId: string, timeoutAt: Date) {
    return this.commandLogModel
      .findOneAndUpdate(
        {
          commandId,
          status: 'sent',
        },
        {
          $set: {
            status: 'timeout',
            error: 'Command timed out waiting for hardware ACK',
          },
        },
        { new: true }
      )
      .lean()
      .exec();
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    return this.commandLogModel.findOne({ idempotencyKey }).sort({ issuedAt: -1 }).lean().exec();
  }

  async findByCommandId(commandId: string) {
    return this.commandLogModel.findOne({ commandId }).lean().exec();
  }

  async findPendingTimeouts(cutoff: Date, limit = 100) {
    return this.commandLogModel
      .find({
        status: 'sent',
        issuedAt: { $lte: cutoff },
      })
      .sort({ issuedAt: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async listLatest(limit = 100) {
    return this.commandLogModel.find({}).sort({ issuedAt: -1 }).limit(limit).lean().exec();
  }

  async findLatestByUser(userId: string) {
    return this.commandLogModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ issuedAt: -1 })
      .lean()
      .exec();
  }
}
