import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateEntryDto {
  @IsOptional()
  @IsString()
  formNo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
  dateBs?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{16}$/)
  boid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  grandfatherName?: string;

  @IsOptional()
  @IsString()
  citizenshipNo?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^9\d{9}$/)
  mobileNo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  appliedUnits?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  panNo?: string;
}
