import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName!: string;
}
