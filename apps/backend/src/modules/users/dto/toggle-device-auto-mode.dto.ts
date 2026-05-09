import { IsString } from "class-validator";

export class ToggleManagedDeviceAutoModeDto {
  @IsString()
  id!: string;
}
