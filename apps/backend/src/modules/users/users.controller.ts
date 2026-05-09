import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { ToggleManagedDeviceAutoModeDto } from "./dto/toggle-device-auto-mode.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { UsersService } from "./users.service";

type JwtRequestUser = {
  userId: string;
  email: string;
};

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  me(@Req() req: { user?: JwtRequestUser }) {
    return this.usersService.getProfile(req.user?.userId ?? "");
  }

  @Patch("me")
  updateMe(
    @Req() req: { user?: JwtRequestUser },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user?.userId ?? "", dto);
  }

  @Get("dashboard")
  dashboard(@Req() req: { user?: JwtRequestUser }) {
    return this.usersService.getDashboard(req.user?.userId ?? "");
  }

  @Get("features")
  features() {
    return this.usersService.getFeatures();
  }

  @Get("settings")
  settings(@Req() req: { user?: JwtRequestUser }) {
    return this.usersService.getSettings(req.user?.userId ?? "");
  }

  @Patch("settings")
  updateSettings(
    @Req() req: { user?: JwtRequestUser },
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(req.user?.userId ?? "", dto);
  }

  @Get("devices")
  devices(@Req() req: { user?: JwtRequestUser }) {
    return this.usersService.getManagedDevices(req.user?.userId ?? "");
  }

  @Patch("devices/auto-mode")
  toggleAutoMode(
    @Req() req: { user?: JwtRequestUser },
    @Body() dto: ToggleManagedDeviceAutoModeDto,
  ) {
    return this.usersService.toggleManagedDeviceAutoMode(
      req.user?.userId ?? "",
      dto.id,
    );
  }
}

