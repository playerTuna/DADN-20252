import { randomUUID } from 'crypto';
import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AutomationLog } from './entity/automation-log.schema';
import { AutomationRuleEntity } from './entity/automation-rule.schema';
import { DeviceState } from '../users/entity/device-state.schema';
import { Device } from '../users/entity/device.schema';
import { User } from '../users/entity/user.schema';
import { CommandService } from '../command/command.service';
import { IngestMqttMessage } from '../telemetry/telemetry.types';
import { AutomationLogEntry, AutomationRule, AutomationSensorKey } from './automation.types';
import { defaultAutomationRules, defaultManagedDevices } from '../users/users.defaults';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

const MAX_AUTOMATION_LOGS = 50;

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Device.name) private readonly deviceModel: Model<Device>,
    @InjectModel(DeviceState.name)
    private readonly deviceStateModel: Model<DeviceState>,
    @InjectModel(AutomationRuleEntity.name)
    private readonly automationRuleModel: Model<AutomationRuleEntity>,
    @InjectModel(AutomationLog.name)
    private readonly automationLogModel: Model<AutomationLog>,
    @Inject(forwardRef(() => CommandService))
    private readonly commandService: CommandService
  ) {}

  async getRules(userId: string) {
    await this.ensureAutomationState(userId);
    return this.automationRuleModel
      .find({ userId: this.toObjectId(userId) })
      .sort({ deviceId: 1 })
      .lean()
      .exec();
  }

  async getLogs(userId: string) {
    await this.ensureAutomationState(userId);
    return this.automationLogModel
      .find({ userId: this.toObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(MAX_AUTOMATION_LOGS)
      .lean()
      .exec();
  }

  async updateRule(userId: string, deviceId: string, dto: UpdateAutomationRuleDto) {
    await this.ensureAutomationState(userId);
    const currentRule = await this.automationRuleModel
      .findOne({ userId: this.toObjectId(userId), deviceId })
      .lean()
      .exec();
    if (!currentRule) {
      throw new NotFoundException(`Automation rule not found for ${deviceId}`);
    }
    await this.automationRuleModel
      .updateOne(
        { userId: this.toObjectId(userId), deviceId },
        {
          $set: {
            enabled: dto.enabled ?? currentRule.enabled,
            sensorKey: dto.sensorKey ?? currentRule.sensorKey,
            turnOnWhen: dto.turnOnWhen ?? currentRule.turnOnWhen,
            turnOffWhen: dto.turnOffWhen ?? currentRule.turnOffWhen,
            onPayload: dto.onPayload ?? currentRule.onPayload,
            offPayload: dto.offPayload ?? currentRule.offPayload,
          },
        }
      )
      .exec();

    if (typeof dto.enabled === 'boolean') {
      await this.deviceStateModel
        .updateOne(
          { userId: this.toObjectId(userId), deviceKey: deviceId },
          { $set: { autoMode: dto.enabled } }
        )
        .exec();
    }

    return this.getRules(userId);
  }

  async setAutoMode(userId: string, deviceId: string, enabled?: boolean) {
    await this.ensureAutomationState(userId);
    const currentRule = await this.automationRuleModel
      .findOne({ userId: this.toObjectId(userId), deviceId })
      .lean()
      .exec();
    if (!currentRule) {
      throw new NotFoundException(`Automation rule not found for ${deviceId}`);
    }
    const nextEnabled = enabled ?? !currentRule?.enabled;

    await Promise.all([
      this.automationRuleModel
        .updateOne(
          { userId: this.toObjectId(userId), deviceId },
          { $set: { enabled: nextEnabled } }
        )
        .exec(),
      this.deviceStateModel
        .updateOne(
          { userId: this.toObjectId(userId), deviceKey: deviceId },
          { $set: { autoMode: nextEnabled } }
        )
        .exec(),
    ]);

    return {
      rules: await this.getRules(userId),
      devices: await this.deviceStateModel
        .find({ userId: this.toObjectId(userId) })
        .lean()
        .exec(),
    };
  }

  async evaluateTelemetry(msg: IngestMqttMessage & { numericValue?: number }) {
    const sensorKey = this.mapTelemetryToSensorKey(msg.logicalKey);
    if (!sensorKey || typeof msg.numericValue !== 'number') {
      return;
    }

    const users = await this.userModel.find({}).lean().exec();
    for (const user of users) {
      await this.ensureAutomationState(String(user._id));
      const [rules, states] = await Promise.all([
        this.automationRuleModel
          .find({
            userId: this.toObjectId(String(user._id)),
            enabled: true,
            sensorKey,
          })
          .lean()
          .exec(),
        this.deviceStateModel
          .find({ userId: this.toObjectId(String(user._id)) })
          .lean()
          .exec(),
      ]);
      const stateByKey = new Map(states.map((state) => [state.deviceKey, state]));
      const matchingRules = rules.filter(
        (rule) => rule.enabled && rule.sensorKey === sensorKey
      ) as AutomationRule[];

      for (const rule of matchingRules) {
        const device = stateByKey.get(rule.deviceId);
        if (!device) continue;

        const desiredAction = this.resolveDesiredAction(
          device.desiredPower ?? device.power,
          msg.numericValue,
          rule
        );
        if (!desiredAction) continue;

        const payload =
          desiredAction === 'ON'
            ? (rule.onPayload ?? desiredAction)
            : (rule.offPayload ?? desiredAction);
        const reason = `${rule.sensorKey}=${msg.numericValue} matched ${desiredAction === 'ON' ? 'turnOnWhen' : 'turnOffWhen'}`;

        try {
          const result = await this.commandService.sendCommand(rule.target, payload, {
            userId: String(user._id),
            source: 'automation',
          });
          await this.appendAutomationLog(String(user._id), {
            id: randomUUID(),
            deviceId: rule.deviceId,
            target: rule.target,
            sensorKey: rule.sensorKey,
            sensorValue: msg.numericValue,
            action: desiredAction,
            payload,
            reason,
            status: 'sent',
            createdAt: new Date(),
            commandId: result.commandId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown automation error';
          this.logger.warn(`Automation failed for ${rule.deviceId}: ${message}`);
          await this.appendAutomationLog(String(user._id), {
            id: randomUUID(),
            deviceId: rule.deviceId,
            target: rule.target,
            sensorKey: rule.sensorKey,
            sensorValue: msg.numericValue,
            action: desiredAction,
            payload,
            reason,
            status: 'failed',
            createdAt: new Date(),
            error: message,
          });
        }
      }
    }
  }

  private resolveDesiredAction(
    currentPower: boolean,
    sensorValue: number,
    rule: AutomationRule
  ): 'ON' | 'OFF' | null {
    if (!currentPower && this.matchesThreshold(sensorValue, rule.turnOnWhen)) {
      return 'ON';
    }
    if (currentPower && this.matchesThreshold(sensorValue, rule.turnOffWhen)) {
      return 'OFF';
    }
    return null;
  }

  private matchesThreshold(value: number, threshold: AutomationRule['turnOnWhen']) {
    return threshold.operator === '<' ? value < threshold.value : value > threshold.value;
  }

  private mapTelemetryToSensorKey(
    logicalKey: IngestMqttMessage['logicalKey']
  ): AutomationSensorKey | null {
    if (logicalKey === 'soil_humidity') return 'soilMoisture';
    if (logicalKey === 'temp') return 'temperature';
    if (logicalKey === 'light') return 'light';
    return null;
  }

  private async appendAutomationLog(userId: string, entry: AutomationLogEntry) {
    await this.automationLogModel.create({
      userId: this.toObjectId(userId),
      logId: entry.id,
      ...entry,
    });

    const overflowLogs = await this.automationLogModel
      .find({ userId: this.toObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(MAX_AUTOMATION_LOGS)
      .select({ _id: 1 })
      .lean()
      .exec();

    if (overflowLogs.length) {
      await this.automationLogModel
        .deleteMany({ _id: { $in: overflowLogs.map((item) => item._id) } })
        .exec();
    }
  }

  private async ensureAutomationState(userId: string) {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) {
      throw new Error('User not found');
    }

    const deviceCount = await this.deviceModel.estimatedDocumentCount().exec();
    if (deviceCount === 0) {
      await this.deviceModel.insertMany(defaultManagedDevices, { ordered: false });
    }

    const objectId = this.toObjectId(userId);
    const [devices, existingStates, existingRules] = await Promise.all([
      this.deviceModel.find({ isActive: true }).lean().exec(),
      this.deviceStateModel.find({ userId: objectId }).lean().exec(),
      this.automationRuleModel.find({ userId: objectId }).lean().exec(),
    ]);
    const existingStateKeys = new Set(existingStates.map((state) => state.deviceKey));
    const existingRuleKeys = new Set(existingRules.map((rule) => rule.deviceId));

    const missingStates = devices.filter((device) => !existingStateKeys.has(device.key));
    if (missingStates.length) {
      await this.deviceStateModel.insertMany(
        missingStates.map((device) => ({
          userId: objectId,
          deviceKey: device.key,
          autoMode: device.defaultAutoMode,
          power: device.defaultPower,
        })),
        { ordered: false }
      );
    }

    const missingRules = defaultAutomationRules.filter(
      (rule) => !existingRuleKeys.has(rule.deviceId)
    );
    if (missingRules.length) {
      await this.automationRuleModel.insertMany(
        missingRules.map((rule) => ({
          userId: objectId,
          ...rule,
        })),
        { ordered: false }
      );
    }

    return user;
  }

  private toObjectId(userId: string) {
    return new Types.ObjectId(userId);
  }
}
