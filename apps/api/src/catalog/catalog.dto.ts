import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PageQuery, toIntList, toStrList } from '../common/pagination';

export const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'rating', 'discount'] as const;
export type Sort = (typeof SORTS)[number];

export class ProductQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['men', 'women', 'kids', 'unisex'] })
  @IsOptional()
  @IsIn(['men', 'women', 'kids', 'unisex'])
  department?: 'men' | 'women' | 'kids' | 'unisex';

  @ApiPropertyOptional({ description: 'Category slug; includes sub-categories' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Full-text search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Comma-separated color ids', example: '1,3' })
  @IsOptional()
  @Transform(toIntList)
  colors?: number[];

  @ApiPropertyOptional({ description: 'Comma-separated size codes', example: 'M,L,32' })
  @IsOptional()
  @Transform(toStrList)
  sizes?: string[];

  @ApiPropertyOptional({ description: 'Comma-separated brand slugs' })
  @IsOptional()
  @Transform(toStrList)
  brands?: string[];

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ enum: SORTS, default: 'relevance' })
  @IsOptional()
  @IsIn(SORTS as unknown as string[])
  sort: Sort = 'relevance';
}
