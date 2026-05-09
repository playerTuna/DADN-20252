import { IsBoolean, IsOptional } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  "pump-1"?: boolean;

  @IsOptional()
  @IsBoolean()
  "pump-2"?: boolean;

  @IsOptional()
  @IsBoolean()
  "led-1"?: boolean;

  @IsOptional()
  @IsBoolean()
  "led-2"?: boolean;

  @IsOptional()
  @IsBoolean()
  "led-3"?: boolean;

  @IsOptional()
  @IsBoolean()
  "schedule-1"?: boolean;

  @IsOptional()
  @IsBoolean()
  "schedule-2"?: boolean;

  @IsOptional()
  @IsBoolean()
  "schedule-3"?: boolean;

  @IsOptional()
  @IsBoolean()
  "dev-1"?: boolean;

  @IsOptional()
  @IsBoolean()
  "dev-2"?: boolean;

  @IsOptional()
  @IsBoolean()
  "dev-3"?: boolean;

  @IsOptional()
  @IsBoolean()
  "dev-4"?: boolean;
}
