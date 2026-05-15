import { randomUUID } from 'crypto';
import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { AutomationLog } from './entity/automation-log.schema';
import { AutomationRuleEntity } from './entity/automation-rule.schema';
import { DeviceState } from '../users/entity/device-state.schema';
import { Device } from '../users/entity/device.schema';
import { User } from '../users/entity/user.schema';
import { Telemetry } from '../telemetry/entity/telemetry.schema';
import { CommandService } from '../command/command.service';
import { ControllableDeviceKey } from '../command/dto/command.dto';
import { IngestMqttMessage } from '../telemetry/telemetry.types';
import {
  AutomationCondition,
  AutomationLogEntry,
  AutomationRule,
  AutomationSensorKey,
} from './automation.types';
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
    @InjectModel(Telemetry.name)
    private readonly telemetryModel: Model<Telemetry>,
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
            turnOnConditions: dto.turnOnConditions ?? currentRule.turnOnConditions,
            turnOffConditions: dto.turnOffConditions ?? currentRule.turnOffConditions,
            schedules: dto.schedules ?? currentRule.schedules,
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

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    const now = new Date();
    // Format to HH:mm in UTC+7 (assumed server/user locality)
    // For simplicity, we use local time formatted as HH:mm
    const currentTimeStr = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    const activeRules = (await this.automationRuleModel
      .find({
        enabled: true,
        'schedules.enabled': true,
        'schedules.time': currentTimeStr,
      })
      .lean()
      .exec()) as unknown as AutomationRuleEntity[];

    for (const rule of activeRules) {
      const userId = String(rule.userId);
      const matchingSchedules = rule.schedules.filter(
        (s) => s.enabled && s.time === currentTimeStr
      );

      if (matchingSchedules.length > 0) {
        const latestTelemetry = await this.getLatestValuesForUser(userId);

        for (const schedule of matchingSchedules) {
          // Evaluate Hybrid Conditions if present
          if (schedule.conditions && schedule.conditions.length > 0) {
            const conditionsMet = schedule.conditions.every((cond) =>
              this.matchesThreshold(latestTelemetry.get(cond.sensorKey) ?? 0, cond)
            );
            if (!conditionsMet) continue;
          }

          const payload = schedule.action === 'ON' ? (rule.onPayload ?? 'ON') : (rule.offPayload ?? 'OFF');
          let reason = `Scheduled at ${schedule.time} (${schedule.action})`;
          if (schedule.conditions && schedule.conditions.length > 0) {
            reason += ` + Hybrid Conditions Met`;
          }

        try {
          const result = await this.commandService.sendCommand(rule.target as ControllableDeviceKey, payload, {
            userId,
            source: 'automation',
          });
          await this.appendAutomationLog(userId, {
            id: randomUUID(),
            deviceId: rule.deviceId,
            target: rule.target,
            action: schedule.action,
            payload,
            reason,
            status: 'sent',
            createdAt: new Date(),
            commandId: result.commandId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown automation schedule error';
          this.logger.error(`Schedule failed for ${rule.deviceId}: ${message}`);
        }
        }
      }
    }
  }

  async evaluateTelemetry(msg: IngestMqttMessage & { numericValue?: number }) {
    const sensorKey = this.mapTelemetryToSensorKey(msg.logicalKey);
    if (!sensorKey || typeof msg.numericValue !== 'number') {
      return;
    }

    const users = await this.userModel.find({}).lean().exec();
    for (const user of users) {
      const userId = String(user._id);
      await this.ensureAutomationState(userId);

      const [rules, states, latestTelemetry] = await Promise.all([
        this.automationRuleModel
          .find({
            userId: this.toObjectId(userId),
            enabled: true,
            $or: [
              { 'turnOnConditions.sensorKey': sensorKey },
              { 'turnOffConditions.sensorKey': sensorKey },
            ],
          })
          .lean()
          .exec(),
        this.deviceStateModel.find({ userId: this.toObjectId(userId) }).lean().exec(),
        this.getLatestValuesForUser(userId),
      ]);

      // Overlay the incoming message's value onto the latest telemetry map
      latestTelemetry.set(sensorKey, msg.numericValue);

      const stateByKey = new Map(states.map((state) => [state.deviceKey, state]));

      for (const rule of rules as unknown as AutomationRule[]) {
        const device = stateByKey.get(rule.deviceId);
        if (!device) continue;

        const desiredAction = this.resolveDesiredAction(
          device.desiredPower ?? device.power,
          latestTelemetry,
          rule
        );

        if (!desiredAction) continue;

        const payload =
          desiredAction === 'ON'
            ? (rule.onPayload ?? desiredAction)
            : (rule.offPayload ?? desiredAction);

        // Build reason string for multiple conditions
        const conditions = desiredAction === 'ON' ? rule.turnOnConditions : rule.turnOffConditions;
        const reason = conditions
          .map((c) => `${c.sensorKey}(${latestTelemetry.get(c.sensorKey)})${c.operator}${c.value}`)
          .join(' AND ');

        try {
          const result = await this.commandService.sendCommand(rule.target as ControllableDeviceKey, payload, {
            userId,
            source: 'automation',
          });
          await this.appendAutomationLog(userId, {
            id: randomUUID(),
            deviceId: rule.deviceId,
            target: rule.target,
            sensorKey,
            sensorValue: msg.numericValue,
            action: desiredAction,
            payload,
            reason: `Threshold met: ${reason}`,
            status: 'sent',
            createdAt: new Date(),
            commandId: result.commandId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown automation error';
          this.logger.warn(`Automation failed for ${rule.deviceId}: ${message}`);
          await this.appendAutomationLog(userId, {
            id: randomUUID(),
            deviceId: rule.deviceId,
            target: rule.target,
            sensorKey,
            sensorValue: msg.numericValue,
            action: desiredAction,
            payload,
            reason: `Threshold error: ${reason}`,
            status: 'failed',
            createdAt: new Date(),
            error: message,
          });
        }
      }
    }
  }

  private async getLatestValuesForUser(userId: string): Promise<Map<AutomationSensorKey, number>> {
    const sensorKeys: AutomationSensorKey[] = ['soilMoisture', 'temperature', 'light'];
    const values = new Map<AutomationSensorKey, number>();

    const results = await Promise.all(
      sensorKeys.map((key) =>
        this.telemetryModel
          .findOne({ type: this.mapSensorKeyToTelemetryType(key) })
          .sort({ receivedAt: -1 })
          .lean()
          .exec()
      )
    );

    results.forEach((res, i) => {
      if (res && typeof res.numericValue === 'number') {
        values.set(sensorKeys[i], res.numericValue);
      } else {
        // Default values if no telemetry exists yet
        values.set(sensorKeys[i], 0);
      }
    });

    return values;
  }

  private resolveDesiredAction(
    currentPower: boolean,
    latestValues: Map<AutomationSensorKey, number>,
    rule: AutomationRule
  ): 'ON' | 'OFF' | null {
    // Check Turn ON conditions (AND logic)
    if (!currentPower && rule.turnOnConditions.length > 0) {
      const allOnMet = rule.turnOnConditions.every((cond) =>
        this.matchesThreshold(latestValues.get(cond.sensorKey) ?? 0, cond)
      );
      if (allOnMet) return 'ON';
    }

    // Check Turn OFF conditions (AND logic)
    if (currentPower && rule.turnOffConditions.length > 0) {
      const allOffMet = rule.turnOffConditions.every((cond) =>
        this.matchesThreshold(latestValues.get(cond.sensorKey) ?? 0, cond)
      );
      if (allOffMet) return 'OFF';
    }

    return null;
  }

  private matchesThreshold(value: number, condition: AutomationCondition) {
    return condition.operator === '<' ? value < condition.value : value > condition.value;
  }

  private mapTelemetryToSensorKey(
    logicalKey: string
  ): AutomationSensorKey | null {
    if (logicalKey === 'soil_humidity') return 'soilMoisture';
    if (logicalKey === 'temp') return 'temperature';
    if (logicalKey === 'light') return 'light';
    return null;
  }

  private mapSensorKeyToTelemetryType(key: AutomationSensorKey): string {
    if (key === 'soilMoisture') return 'soil_humidity';
    if (key === 'temperature') return 'temp';
    return 'light';
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
