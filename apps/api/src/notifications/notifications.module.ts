import { Body, Controller, Get, HttpCode, Module, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth.decorators';
import { PageQuery } from '../common/pagination';
import { NotificationListeners } from './notification.listeners';
import { LogEmailProvider, LogPushProvider, NotificationsService } from './notifications.service';

class ListQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean;
}
class PrefDto {
  @ApiProperty({ enum: NotificationsService.TYPES }) @IsIn(NotificationsService.TYPES) type: any;
  @ApiProperty({ enum: NotificationsService.CHANNELS }) @IsIn(NotificationsService.CHANNELS) channel: any;
  @ApiProperty() @IsBoolean() enabled: boolean;
}
class DeviceDto {
  @ApiProperty() @IsString() @MaxLength(4096) token: string;
  @ApiProperty({ enum: ['android', 'ios', 'web'] }) @IsIn(['android', 'ios', 'web']) platform: 'android' | 'ios' | 'web';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) appVersion?: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private n: NotificationsService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.n.list(u.id, q.page, Math.min(q.limit, 50), q.unread);
  }
  @Get('unread-count') unread(@CurrentUser() u: AuthUser) {
    return this.n.unreadCount(u.id);
  }
  @HttpCode(200) @Post('read-all') readAll(@CurrentUser() u: AuthUser) {
    return this.n.markRead(u.id);
  }
  @HttpCode(200) @Post(':id/read') read(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.n.markRead(u.id, BigInt(id));
  }
  @Get('preferences') prefs(@CurrentUser() u: AuthUser) {
    return this.n.preferences(u.id);
  }
  @Put('preferences') setPref(@CurrentUser() u: AuthUser, @Body() dto: PrefDto) {
    return this.n.setPreference(u.id, dto.type, dto.channel, dto.enabled);
  }
  @HttpCode(204) @Post('devices') device(@CurrentUser() u: AuthUser, @Body() dto: DeviceDto) {
    return this.n.registerDevice(u.id, dto.token, dto.platform, dto.appVersion);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationListeners, LogPushProvider, LogEmailProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
