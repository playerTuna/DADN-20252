import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AutomationLog } from "../automation/entity/automation-log.schema";
import { AutomationRuleEntity } from "../automation/entity/automation-rule.schema";
import { CommandLog } from "../command/entity/command-log.schema";
import { Alert } from "../telemetry/entity/alert.schema";
import { Telemetry } from "../telemetry/entity/telemetry.schema";
import { TelemetryType } from "../telemetry/telemetry.types";
import { User } from "./entity/user.schema";
import { Device } from "./entity/device.schema";
import { DeviceState } from "./entity/device-state.schema";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { appFeatures, defaultAutomationRules, defaultDeviceSettings, defaultManagedDevices } from "./users.defaults";

type DashboardNavKey = "home" | "analytics" | "devices";
type DashboardState = "live" | "stale" | "no_data";
type DashboardStat = {
  label: string;
  value: string;
  icon: string;
};
type DashboardControl = {
  id: string;
  name: string;
  state: "online" | "offline";
  mode: "manually" | "auto";
  type: "pump" | "light";
  enabled: boolean;
};
type DashboardAlert = {
  id: string;
  text: string;
  time: string;
};
type DashboardSection = {
  title: string;
  stats: DashboardStat[];
  controls: DashboardControl[];
  alerts: DashboardAlert[];
};
type DashboardPayload = Record<DashboardNavKey, DashboardSection>;

type ManagedDevicePowerValue = "ON" | "OFF" | "1" | "0";
type DeviceCommandStatus = "idle" | "sent" | "acked" | "timeout" | "failed";
type DeviceConnectionStatus = "online" | "offline" | "unknown";
type SensorSnapshot = {
  label: string;
  type: Extract<TelemetryType, "temp" | "air_humidity" | "soil_humidity" | "light">;
  icon: string;
  suffix: string;
};

const SENSOR_SNAPSHOTS: SensorSnapshot[] = [
  {
    label: "Temperature",
    type: "temp",
    icon: "thermometer-outline",
    suffix: "",
  },
  {
    label: "Air Humidity",
    type: "air_humidity",
    icon: "cloud-outline",
    suffix: "%",
  },
  {
    label: "Soil Humidity",
    type: "soil_humidity",
    icon: "water-outline",
    suffix: "%",
  },
  {
    label: "Light Intensity",
    type: "light",
    icon: "sunny-outline",
    suffix: "%",
  },
];

const DASHBOARD_STALE_MS = 5 * 60 * 1000;
const DASHBOARD_ALERT_LIMIT = 10;

@Injectable()
export class UsersService {
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
    @InjectModel(Alert.name)
    private readonly alertModel: Model<Alert>,
    @InjectModel(CommandLog.name)
    private readonly commandLogModel: Model<CommandLog>,
  ) {}

  async findByEmail(email: string) {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .lean()
      .exec();
  }

  async findById(id: string) {
    return this.userModel.findById(id).lean().exec();
  }

  async create(email: string, passwordHash: string) {
    const created = await this.userModel.create({
      email: email.trim().toLowerCase(),
      passwordHash,
      displayName: email.trim().split("@")[0] || "User",
      deviceSettings: defaultDeviceSettings,
    });
    await this.ensureManagedDeviceRecords(String(created._id));
    await this.ensureAutomationRuleRecords(String(created._id));
    return created.toObject();
  }

  async getDashboard(userId: string): Promise<DashboardPayload> {
    await this.requireUser(userId);
    await this.ensureManagedDeviceRecords(userId);
    await this.ensureAutomationRuleRecords(userId);

    const objectId = this.toObjectId(userId);
    const telemetryTypes = SENSOR_SNAPSHOTS.map((item) => item.type);

    const [
      devices,
      states,
      rules,
      latestTelemetry,
      alerts,
      automationLogs,
      lastCommand,
    ] = await Promise.all([
      this.deviceModel.find({ isActive: true }).sort({ key: 1 }).lean().exec(),
      this.deviceStateModel.find({ userId: objectId }).sort({ deviceKey: 1 }).lean().exec(),
      this.automationRuleModel.find({ userId: objectId }).sort({ deviceId: 1 }).lean().exec(),
      Promise.all(
        telemetryTypes.map((type) =>
          this.telemetryModel.findOne({ type }).sort({ receivedAt: -1 }).lean().exec(),
        ),
      ),
      this.alertModel.find({}).sort({ triggeredAt: -1 }).limit(DASHBOARD_ALERT_LIMIT).lean().exec(),
      this.automationLogModel
        .find({ userId: objectId })
        .sort({ createdAt: -1 })
        .limit(DASHBOARD_ALERT_LIMIT)
        .lean()
        .exec(),
      this.commandLogModel
        .findOne({ userId: objectId })
        .sort({ issuedAt: -1 })
        .lean()
        .exec(),
    ]);

    const telemetryByType = new Map(
      latestTelemetry
        .filter((entry): entry is NonNullable<(typeof latestTelemetry)[number]> => Boolean(entry))
        .map((entry) => [entry.type, entry]),
    );
    const stateByKey = new Map(states.map((state) => [state.deviceKey, state]));
    const ruleByDeviceId = new Map(rules.map((rule) => [rule.deviceId, rule]));

    const controls = devices.map<DashboardControl>((device) => {
      const state = stateByKey.get(device.key);
      const rule = ruleByDeviceId.get(device.key);
      const autoMode = state?.autoMode ?? rule?.enabled ?? device.defaultAutoMode;
      const power = state?.power ?? device.defaultPower;
      return {
        id: device.key,
        name: device.name,
        state: power || autoMode ? "online" : "offline",
        mode: autoMode ? "auto" : "manually",
        type: device.type === "pump" ? "pump" : "light",
        enabled: power,
      };
    });

    const poweredOnCount = controls.filter((item) => item.enabled).length;
    const autoEnabledCount = controls.filter((item) => item.mode === "auto").length;
    const noDataCount = SENSOR_SNAPSHOTS.filter((sensor) => {
      const doc = telemetryByType.get(sensor.type);
      return this.getTelemetryState(doc?.receivedAt) === "no_data";
    }).length;
    const staleCount = SENSOR_SNAPSHOTS.filter((sensor) => {
      const doc = telemetryByType.get(sensor.type);
      return this.getTelemetryState(doc?.receivedAt) === "stale";
    }).length;

    const newestAlert = alerts[0];
    const newestAutomationLog = automationLogs[0];

    return {
      home: {
        title: "Home - Dashboards",
        stats: SENSOR_SNAPSHOTS.map((sensor) =>
          this.buildSensorStat(sensor, telemetryByType.get(sensor.type)),
        ),
        controls,
        alerts: this.buildDashboardAlerts({
          alerts,
          automationLogs,
          lastCommand,
          telemetryByType,
        }),
      },
      analytics: {
        title: "Analytics - Dashboards",
        stats: [
          {
            label: "Active Alerts",
            value: String(alerts.length),
            icon: "warning-outline",
          },
          {
            label: "Latest Alert",
            value: newestAlert
              ? `${this.formatAlertLabel(newestAlert.type)} ${newestAlert.level}`
              : "No alerts",
            icon: "notifications-outline",
          },
          {
            label: "Last Auto Action",
            value: newestAutomationLog
              ? `${newestAutomationLog.action} (${newestAutomationLog.status})`
              : "No auto action",
            icon: "flash-outline",
          },
          {
            label: "Last Command",
            value: lastCommand
              ? `${lastCommand.target} ${lastCommand.status}`
              : "No command",
            icon: "send-outline",
          },
        ],
        controls,
        alerts: this.buildAnalyticsAlerts(newestAlert, newestAutomationLog, lastCommand),
      },
      devices: {
        title: "Devices - Dashboards",
        stats: [
          {
            label: "Devices Powered On",
            value: `${poweredOnCount}/${controls.length}`,
            icon: "hardware-chip-outline",
          },
          {
            label: "Auto Mode Enabled",
            value: String(autoEnabledCount),
            icon: "timer-outline",
          },
          {
            label: "No Data Sensors",
            value: String(noDataCount),
            icon: "remove-circle-outline",
          },
          {
            label: "Stale Sensors",
            value: String(staleCount),
            icon: "alert-circle-outline",
          },
        ],
        controls,
        alerts: this.buildDeviceAlerts(controls, newestAutomationLog, lastCommand),
      },
    };
  }

  async getFeatures() {
    return appFeatures;
  }

  async getProfile(userId: string) {
    const user = await this.requireUser(userId);
    return {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName || user.email.split("@")[0] || "User",
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { displayName: dto.displayName.trim() } },
      )
      .exec();

    return this.getProfile(userId);
  }

  async getSettings(userId: string) {
    const user = await this.requireUser(userId);
    const nextSettings = {
      ...defaultDeviceSettings,
      ...(user.deviceSettings ?? {}),
    };

    if (JSON.stringify(nextSettings) !== JSON.stringify(user.deviceSettings ?? {})) {
      await this.userModel
        .updateOne({ _id: userId }, { $set: { deviceSettings: nextSettings } })
        .exec();
    }

    return nextSettings;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const user = await this.requireUser(userId);
    const nextSettings = {
      ...defaultDeviceSettings,
      ...user.deviceSettings,
      ...dto,
    };

    await this.userModel
      .updateOne({ _id: userId }, { $set: { deviceSettings: nextSettings } })
      .exec();

    return nextSettings;
  }

  async getManagedDevices(userId: string) {
    await this.requireUser(userId);
    await this.ensureManagedDeviceRecords(userId);
    await this.ensureAutomationRuleRecords(userId);

    const [devices, states, rules] = await Promise.all([
      this.deviceModel.find({ isActive: true }).sort({ key: 1 }).lean().exec(),
      this.deviceStateModel.find({ userId: this.toObjectId(userId) }).lean().exec(),
      this.automationRuleModel.find({ userId: this.toObjectId(userId) }).lean().exec(),
    ]);

    const stateByKey = new Map(states.map((state) => [state.deviceKey, state]));
    const ruleByDeviceId = new Map(rules.map((rule) => [rule.deviceId, rule]));

    return devices.map((device) => {
      const state = stateByKey.get(device.key);
      const rule = ruleByDeviceId.get(device.key);
      const desiredPower = state?.desiredPower ?? state?.power ?? device.defaultPower;
      return {
        id: device.key,
        name: device.name,
        autoMode: state?.autoMode ?? rule?.enabled ?? device.defaultAutoMode,
        power: desiredPower,
        desiredPower,
        actualPower: state?.actualPower ?? null,
        lastCommandStatus: state?.lastCommandStatus ?? "idle",
        lastCommandAt: state?.lastCommandAt?.toISOString() ?? null,
        lastAckAt: state?.lastAckAt?.toISOString() ?? null,
        lastSeenAt: state?.lastSeenAt?.toISOString() ?? null,
        connectionStatus: state?.connectionStatus ?? "unknown",
      };
    });
  }

  async toggleManagedDeviceAutoMode(userId: string, deviceId: string) {
    await this.requireUser(userId);
    await this.ensureManagedDeviceRecords(userId);
    await this.ensureAutomationRuleRecords(userId);

    const currentRule = await this.automationRuleModel
      .findOne({ userId: this.toObjectId(userId), deviceId })
      .lean()
      .exec();
    if (!currentRule) {
      throw new BadRequestException(
        `No automation rule configured for device ${deviceId}`,
      );
    }
    const nextEnabled = !currentRule.enabled;

    await Promise.all([
      this.automationRuleModel
        .updateOne(
          { userId: this.toObjectId(userId), deviceId },
          { $set: { enabled: nextEnabled } },
        )
        .exec(),
      this.deviceStateModel
        .updateOne(
          { userId: this.toObjectId(userId), deviceKey: deviceId },
          { $set: { autoMode: nextEnabled } },
        )
        .exec(),
    ]);

    return this.getManagedDevices(userId);
  }

  async updateManagedDevicePower(
    userId: string,
    deviceId: string,
    value: ManagedDevicePowerValue,
  ) {
    return this.markDeviceCommandSent(userId, deviceId, value, new Date());
  }

  async markDeviceCommandSent(
    userId: string,
    deviceId: string,
    value: ManagedDevicePowerValue,
    issuedAt: Date,
  ) {
    await this.requireUser(userId);
    await this.ensureManagedDeviceRecords(userId);
    const nextPower = value === "ON" || value === "1";
    await this.deviceStateModel
      .updateOne(
        { userId: this.toObjectId(userId), deviceKey: deviceId },
        {
          $set: {
            power: nextPower,
            desiredPower: nextPower,
            lastCommandStatus: "sent",
            lastCommandAt: issuedAt,
          },
        },
      )
      .exec();

    return this.getManagedDevices(userId);
  }

  async markDeviceCommandFailed(
    userId: string,
    deviceId: string,
    failedAt: Date,
  ) {
    await this.deviceStateModel
      .updateOne(
        { userId: this.toObjectId(userId), deviceKey: deviceId },
        {
          $set: {
            lastCommandStatus: "failed",
            lastCommandAt: failedAt,
          },
        },
      )
      .exec();
  }

  async markDeviceCommandTimeout(
    userId: string,
    deviceId: string,
    timeoutAt: Date,
  ) {
    await this.deviceStateModel
      .updateOne(
        { userId: this.toObjectId(userId), deviceKey: deviceId },
        {
          $set: {
            lastCommandStatus: "timeout",
            connectionStatus: "unknown",
          },
        },
      )
      .exec();
  }

  async applyHardwareAck(params: {
    userId?: string;
    deviceId: string;
    power?: boolean;
    timestamp: Date;
    commandStatus?: Extract<DeviceCommandStatus, "acked" | "timeout" | "failed">;
    connectionStatus?: DeviceConnectionStatus;
  }) {
    const filter = params.userId
      ? { userId: this.toObjectId(params.userId), deviceKey: params.deviceId }
      : { deviceKey: params.deviceId };
    const setPayload: Record<string, unknown> = {
      lastSeenAt: params.timestamp,
      connectionStatus: params.connectionStatus ?? "online",
    };

    if (typeof params.power === "boolean") {
      setPayload.actualPower = params.power;
    }
    if (params.commandStatus) {
      setPayload.lastCommandStatus = params.commandStatus;
    }
    if (params.commandStatus === "acked") {
      setPayload.lastAckAt = params.timestamp;
    }

    await this.deviceStateModel.updateMany(filter, { $set: setPayload }).exec();
  }

  private async requireUser(userId: string) {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private async ensureManagedDeviceRecords(userId: string) {
    await this.seedDeviceCatalog();
    const objectId = this.toObjectId(userId);
    const [devices, existingStates] = await Promise.all([
      this.deviceModel.find({ isActive: true }).lean().exec(),
      this.deviceStateModel.find({ userId: objectId }).lean().exec(),
    ]);
    const existingKeys = new Set(existingStates.map((state) => state.deviceKey));
    const missingDevices = devices.filter((device) => !existingKeys.has(device.key));
    if (!missingDevices.length) {
      return;
    }

    await this.deviceStateModel.insertMany(
      missingDevices.map((device) => ({
        userId: objectId,
        deviceKey: device.key,
        autoMode: device.defaultAutoMode,
        power: device.defaultPower,
        desiredPower: device.defaultPower,
        actualPower: undefined,
        lastCommandStatus: "idle",
        connectionStatus: "unknown",
      })),
      { ordered: false },
    );
  }

  private async ensureAutomationRuleRecords(userId: string) {
    const objectId = this.toObjectId(userId);
    const existingRules = await this.automationRuleModel
      .find({ userId: objectId })
      .lean()
      .exec();
    const existingKeys = new Set(existingRules.map((rule) => rule.deviceId));
    const missingRules = defaultAutomationRules.filter(
      (rule) => !existingKeys.has(rule.deviceId),
    );

    if (!missingRules.length) {
      return;
    }

    await this.automationRuleModel.insertMany(
      missingRules.map((rule) => ({
        userId: objectId,
        ...rule,
      })),
      { ordered: false },
    );
  }

  private async seedDeviceCatalog() {
    const count = await this.deviceModel.estimatedDocumentCount().exec();
    if (count > 0) {
      return;
    }

    await this.deviceModel.insertMany(defaultManagedDevices, { ordered: false });
  }

  private toObjectId(userId: string) {
    return new Types.ObjectId(userId);
  }

  private buildSensorStat(sensor: SensorSnapshot, doc: Telemetry | null | undefined): DashboardStat {
    const state = this.getTelemetryState(doc?.receivedAt);
    const value = this.formatTelemetryValue(sensor.type, doc?.numericValue, sensor.suffix);
    return {
      label: sensor.label,
      value: `${value} (${state})`,
      icon: sensor.icon,
    };
  }

  private buildDashboardAlerts(params: {
    alerts: Alert[];
    automationLogs: AutomationLog[];
    lastCommand: CommandLog | null;
    telemetryByType: Map<string, Telemetry>;
  }): DashboardAlert[] {
    const items: DashboardAlert[] = [];
    const latestAlert = params.alerts[0];
    const latestAutomation = params.automationLogs[0];

    if (latestAlert) {
      items.push({
        id: `alert-${String((latestAlert as any)._id)}`,
        text: `${this.formatAlertLabel(latestAlert.type)} ${latestAlert.level} (${latestAlert.value})`,
        time: this.formatTime(latestAlert.triggeredAt),
      });
    }

    if (latestAutomation) {
      items.push({
        id: `auto-${latestAutomation.logId}`,
        text: `${latestAutomation.deviceId} auto ${latestAutomation.action} (${latestAutomation.status})`,
        time: this.formatTime(latestAutomation.createdAt),
      });
    }

    if (params.lastCommand) {
      items.push({
        id: `cmd-${params.lastCommand.commandId}`,
        text: `Last command ${params.lastCommand.target} ${params.lastCommand.status}`,
        time: this.formatTime(params.lastCommand.issuedAt),
      });
    }

    for (const sensor of SENSOR_SNAPSHOTS) {
      const telemetry = params.telemetryByType.get(sensor.type);
      const state = this.getTelemetryState(telemetry?.receivedAt);
      if (state === "live") continue;
      items.push({
        id: `sensor-${sensor.type}-${state}`,
        text:
          state === "no_data"
            ? `${sensor.label} has no data yet`
            : `${sensor.label} is stale`,
        time: telemetry?.receivedAt ? this.formatTime(telemetry.receivedAt) : "—",
      });
    }

    return items.slice(0, DASHBOARD_ALERT_LIMIT);
  }

  private buildAnalyticsAlerts(
    newestAlert?: Alert,
    newestAutomationLog?: AutomationLog,
    lastCommand?: CommandLog | null,
  ): DashboardAlert[] {
    const items: DashboardAlert[] = [];

    if (newestAlert) {
      items.push({
        id: `analytics-alert-${String((newestAlert as any)._id)}`,
        text: `Latest alert: ${this.formatAlertLabel(newestAlert.type)} ${newestAlert.level}`,
        time: this.formatTime(newestAlert.triggeredAt),
      });
    }

    if (newestAutomationLog) {
      items.push({
        id: `analytics-auto-${newestAutomationLog.logId}`,
        text: `Last automation: ${newestAutomationLog.deviceId} ${newestAutomationLog.action} (${newestAutomationLog.status})`,
        time: this.formatTime(newestAutomationLog.createdAt),
      });
    }

    if (lastCommand) {
      items.push({
        id: `analytics-command-${lastCommand.commandId}`,
        text: `Last command: ${lastCommand.target} ${lastCommand.status}`,
        time: this.formatTime(lastCommand.issuedAt),
      });
    }

    if (items.length === 0) {
      items.push({
        id: "analytics-empty",
        text: "No analytics events yet",
        time: "—",
      });
    }

    return items;
  }

  private buildDeviceAlerts(
    controls: DashboardControl[],
    newestAutomationLog?: AutomationLog,
    lastCommand?: CommandLog | null,
  ): DashboardAlert[] {
    const offlineControls = controls.filter((control) => control.state === "offline");
    const items: DashboardAlert[] = offlineControls.slice(0, 3).map((control) => ({
      id: `device-offline-${control.id}`,
      text: `${control.name} is currently offline`,
      time: "now",
    }));

    if (newestAutomationLog) {
      items.push({
        id: `device-auto-${newestAutomationLog.logId}`,
        text: `${newestAutomationLog.deviceId} last auto action ${newestAutomationLog.action} (${newestAutomationLog.status})`,
        time: this.formatTime(newestAutomationLog.createdAt),
      });
    }

    if (lastCommand) {
      items.push({
        id: `device-command-${lastCommand.commandId}`,
        text: `${lastCommand.target} last command ${lastCommand.status}`,
        time: this.formatTime(lastCommand.issuedAt),
      });
    }

    if (items.length === 0) {
      items.push({
        id: "device-empty",
        text: "No device events yet",
        time: "—",
      });
    }

    return items.slice(0, DASHBOARD_ALERT_LIMIT);
  }

  private getTelemetryState(receivedAt?: Date): DashboardState {
    if (!receivedAt) {
      return "no_data";
    }
    return Date.now() - new Date(receivedAt).getTime() <= DASHBOARD_STALE_MS
      ? "live"
      : "stale";
  }

  private formatTelemetryValue(
    type: SensorSnapshot["type"],
    numericValue: number | undefined,
    suffix: string,
  ) {
    if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
      return "—";
    }
    const rounded = Math.round(numericValue);
    return type === "temp" ? `${rounded}` : `${rounded}${suffix}`;
  }

  private formatAlertLabel(type: string) {
    if (type === "temp") return "Temperature";
    if (type === "air_humidity") return "Air humidity";
    if (type === "soil_humidity") return "Soil humidity";
    if (type === "light") return "Light";
    return type;
  }

  private formatTime(value?: Date) {
    if (!value) {
      return "—";
    }
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
}
