import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class ThresholdDto {
  @IsIn(["<", ">"])
  operator!: "<" | ">";

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  value!: number;
}

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(["soilMoisture", "temperature", "light"])
  sensorKey?: "soilMoisture" | "temperature" | "light";

  @IsOptional()
  @ValidateNested()
  @Type(() => ThresholdDto)
  turnOnWhen?: ThresholdDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ThresholdDto)
  turnOffWhen?: ThresholdDto;

  @IsOptional()
  @IsString()
  onPayload?: string;

  @IsOptional()
  @IsString()
  offPayload?: string;
}
