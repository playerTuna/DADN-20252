import { IsISO8601, IsOptional } from "class-validator";

export class WeeklyReportQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;
}
