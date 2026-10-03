import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 24, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit = 24;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const paged = <T>(items: T[], total: number, page: number, limit: number): Paged<T> => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Parse "1,2,3" or ["1","2"] query values into a list of ints. */
export const toIntList = ({ value }: { value: unknown }): number[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((v) => parseInt(String(v), 10)).filter((n) => Number.isFinite(n));
};

export const toStrList = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((v) => String(v).trim()).filter(Boolean);
};
