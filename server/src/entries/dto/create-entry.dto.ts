import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateEntryDto {
  @IsString()
  @IsNotEmpty()
  formNo!: string;

  @IsString()
  @Matches(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
  dateBs!: string;

  @IsString()
  @Matches(/^\d{16}$/)
  boid!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsNotEmpty()
  fatherName!: string;

  @IsString()
  @IsNotEmpty()
  grandfatherName!: string;

  @IsString()
  @IsNotEmpty()
  citizenshipNo!: string;

  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @IsString()
  @IsNotEmpty()
  accountNo!: string;

  @IsString()
  @Matches(/^9\d{9}$/)
  mobileNo!: string;

  @IsInt()
  @Min(1)
  appliedUnits!: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  panNo?: string;
}
