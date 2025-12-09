import {
  IsString,
  IsArray,
  IsEnum,
  IsIn,
  Matches,
  MinLength,
} from 'class-validator';

enum ExpiryUnit {
  HOUR = '1H',
  DAY = '1D',
  MONTH = '1M',
  YEAR = '1Y',
}

export class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsEnum(['deposit', 'transfer', 'read'], { each: true })
  permissions: string[];

  @IsString()
  @IsIn(['1H', '1D', '1M', '1Y'])
  expiry: string;
}
