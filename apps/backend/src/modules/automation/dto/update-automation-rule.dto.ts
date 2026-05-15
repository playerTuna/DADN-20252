import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ConditionDto {
  @IsIn(['soilMoisture', 'temperature', 'light'])
  sensorKey!: 'soilMoisture' | 'temperature' | 'light';

  @IsIn(['<', '>'])
  operator!: '<' | '>';

  @IsNumber()
  value!: number;
}

class ScheduleDto {
  @IsString()
  time!: string;

  @IsIn(['ON', 'OFF'])
  action!: 'ON' | 'OFF';

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];
}

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  turnOnConditions?: ConditionDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  turnOffConditions?: ConditionDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto)
  schedules?: ScheduleDto[];

  @IsOptional()
  @IsString()
  onPayload?: string;

  @IsOptional()
  @IsString()
  offPayload?: string;
}
