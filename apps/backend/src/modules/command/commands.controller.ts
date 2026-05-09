import { Body, Controller, Get, Headers, Post, Req } from "@nestjs/common";
import { CommandLogService } from "./command-log.service";
import {
  ControllableDeviceKey,
  SetPumpDto,
  SetRgbDto,
  SetToggleDto,
} from "./dto/command.dto";
import { CommandService } from "./command.service";

type JwtRequestUser = {
  userId: string;
  email: string;
};

@Controller("commands")
export class CommandsController {
  constructor(
    private readonly commandService: CommandService,
    private readonly commandLogService: CommandLogService,
  ) {}

  @Post("pump")
  async setPump(
    @Body() dto: SetPumpDto,
    @Req() req: { user?: JwtRequestUser },
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.sendCommand("pump", dto.value, req.user?.userId, idempotencyKey);
  }

  @Post("rgb")
  async setRgb(
    @Body() dto: SetRgbDto,
    @Req() req: { user?: JwtRequestUser },
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    const format = dto.format ?? "csv";
    const payload =
      format === "json"
        ? JSON.stringify({ r: dto.r, g: dto.g, b: dto.b })
        : `${dto.r},${dto.g},${dto.b}`;
    return this.sendCommand("rgb", payload, req.user?.userId, idempotencyKey);
  }

  @Post("fan")
  async setFan(
    @Body() dto: SetToggleDto,
    @Req() req: { user?: JwtRequestUser },
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.sendCommand("fan", dto.value, req.user?.userId, idempotencyKey);
  }

  @Post("speaker")
  async setSpeaker(
    @Body() dto: SetToggleDto,
    @Req() req: { user?: JwtRequestUser },
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.sendCommand("speaker", dto.value, req.user?.userId, idempotencyKey);
  }

  @Get("logs")
  async logs() {
    return this.commandLogService.listLatest();
  }

  private async sendCommand(
    target: ControllableDeviceKey,
    payload: string,
    userId?: string,
    idempotencyKey?: string,
  ) {
    return this.commandService.sendCommand(target, payload, {
      userId,
      idempotencyKey,
    });
  }
}
