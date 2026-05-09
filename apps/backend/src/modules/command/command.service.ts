import { randomUUID } from "crypto";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MqttService } from "../mqtt/mqtt.service";
import { UsersService } from "../users/users.service";
import { CommandLogService } from "./command-log.service";
import { ControllableDeviceKey } from "./dto/command.dto";

type SendCommandOptions = {
  userId?: string;
  idempotencyKey?: string;
  source?: "manual" | "automation";
};

@Injectable()
export class CommandService implements OnModuleInit, OnModuleDestroy {
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly mqttService: MqttService,
    private readonly commandLogService: CommandLogService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    this.timeoutTimer = setInterval(() => {
      void this.processPendingTimeouts();
    }, 5_000);
  }

  onModuleDestroy() {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  async sendCommand(
    target: ControllableDeviceKey,
    payload: string,
    options: SendCommandOptions = {},
  ) {
    if (options.idempotencyKey) {
      const existed = await this.commandLogService.findByIdempotencyKey(
        options.idempotencyKey,
      );
      if (existed) {
        return {
          ok: true,
          deduplicated: true,
          command: existed,
          commandId: existed.commandId,
        };
      }
    }

    const commandId = randomUUID();
    const issuedAt = new Date();
    const outboundPayload = this.buildOutboundPayload({
      commandId,
      target,
      payload,
      issuedAt,
    });

    await this.commandLogService.createSent({
      commandId,
      target,
      payload,
      issuedAt,
      idempotencyKey: options.idempotencyKey,
      userId: options.userId,
      source: options.source,
    });

    try {
      await this.mqttService.publishWithRetry(target, outboundPayload, 3);
      if (options.userId) {
        await this.syncManagedDeviceDesiredPower(
          options.userId,
          target,
          payload,
          issuedAt,
        );
      }
      return { ok: true, commandId, status: "sent" };
    } catch (err) {
      await this.commandLogService.markFailed(
        commandId,
        err instanceof Error ? err.message : "Unknown MQTT publish error",
      );
      if (options.userId) {
        await this.usersService.markDeviceCommandFailed(
          options.userId,
          target,
          new Date(),
        );
      }
      throw err;
    }
  }

  private async syncManagedDeviceDesiredPower(
    userId: string,
    target: ControllableDeviceKey,
    payload: string,
    issuedAt: Date,
  ) {
    if (target === "fan" || target === "pump" || target === "speaker") {
      await this.usersService.markDeviceCommandSent(
        userId,
        target,
        payload as "ON" | "OFF" | "1" | "0",
        issuedAt,
      );
      return;
    }

    if (target === "rgb") {
      const normalized = payload.trim();
      const isOn = normalized !== "0,0,0" && normalized !== '{"r":0,"g":0,"b":0}';
      await this.usersService.markDeviceCommandSent(
        userId,
        "rgb",
        isOn ? "ON" : "OFF",
        issuedAt,
      );
    }
  }

  private async processPendingTimeouts() {
    const timeoutMs = Number(process.env.COMMAND_ACK_TIMEOUT_MS ?? 15000);
    const cutoff = new Date(Date.now() - timeoutMs);
    const pending = await this.commandLogService.findPendingTimeouts(cutoff);

    for (const command of pending) {
      const timedOut = await this.commandLogService.markTimedOut(
        command.commandId,
        new Date(),
      );
      if (!timedOut?.userId) {
        continue;
      }
      await this.usersService.markDeviceCommandTimeout(
        String(timedOut.userId),
        timedOut.target,
        new Date(),
      );
    }
  }

  private buildOutboundPayload(params: {
    commandId: string;
    target: ControllableDeviceKey;
    payload: string;
    issuedAt: Date;
  }) {
    const format = (process.env.COMMAND_PAYLOAD_FORMAT ?? "raw").trim().toLowerCase();
    if (format !== "json") {
      return params.payload;
    }

    return JSON.stringify({
      commandId: params.commandId,
      deviceId: params.target,
      value: params.payload,
      issuedAt: params.issuedAt.toISOString(),
    });
  }
}
