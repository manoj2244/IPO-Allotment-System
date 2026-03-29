import { IsIn, IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class CreateIpoDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  companyCode!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerUnit!: number;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsInt()
  @Min(1)
  issuedUnits!: number;

  @IsInt()
  @Min(1)
  minUnits!: number;

  @IsInt()
  @Min(1)
  maxUnits!: number;

  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}
