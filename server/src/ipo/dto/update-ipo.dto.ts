import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class UpdateIpoDto {
	@IsOptional()
	@IsString()
	companyName?: string;

	@IsOptional()
	@IsString()
	companyCode?: string;

	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@IsPositive()
	pricePerUnit?: number;

	@IsOptional()
	@IsString()
	district?: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	issuedUnits?: number;

	@IsOptional()
	@IsInt()
	@Min(1)
	minUnits?: number;

	@IsOptional()
	@IsInt()
	@Min(1)
	maxUnits?: number;

	@IsOptional()
	@IsIn(['ACTIVE', 'INACTIVE'])
	status?: 'ACTIVE' | 'INACTIVE';
}
