import { Injectable, Logger } from '@nestjs/common';
import type { notification_channel, notification_type } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { paged } from '../common/pagination';

export interface Outgoing {
  userId: bigint;
  type: notification_type;
  title: string;
  body: string;
  deepLink?: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
}

/** Channel provider port - implement FCM (push), SES/SendGrid (email), MSG91/Twilio (sms). */
export abstract class ChannelProvider {
  abstract channel: notification_channel;
  abstract send(to: { userId: bigint; email?: string | null; phone?: string | null; tokens: string[] }, msg: Outgoing): Promise<void>;
}

@Injectable()
export class LogPushProvider extends ChannelProvider {
  channel = 'push' as const;
  private log = new Logger('push');
  async send(to: { tokens: string[] }, msg: Outgoing) {
    if (!to.tokens.length) throw new Error('no device tokens');
    this.log.log(`[FCM stub] -> ${to.tokens.length} device(s): ${msg.title}`);
  }
}

@Injectable()
export class LogEmailProvider extends ChannelProvider {
  channel = 'email' as const;
  private log = new Logger('email');
  async send(to: { email?: string | null }, msg: Outgoing) {
    if (!to.email) throw new Error('no email');
    this.log.log(`[email stub] -> ${to.email}: ${msg.title}`);
  }
}

const render = (tpl: string, vars: Record<string, unknown>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));

@Injectable()
export class NotificationsService {
  private log = new Logger(NotificationsService.name);
  private providers: ChannelProvider[];

  constructor(private prisma: PrismaService, push: LogPushProvider, email: LogEmailProvider) {
    this.providers = [push, email];
  }

  /**
   * Render a template and fan out to channels the user hasn't disabled.
   * The in-app row is always written (it's the notification centre); other channels are best-effort.
   */
  async notifyTemplate(userId: bigint, code: string, vars: Record<string, unknown>, extra: { deepLink?: string; data?: Record<string, unknown> } = {}) {
    const templates = await this.prisma.notification_templates.findMany({ where: { code, is_active: true } });
    if (!templates.length) {
      this.log.warn(`No template ${code}`);
      return;
    }
    const type = templates[0].type;
    const prefs = await this.prisma.notification_preferences.findMany({ where: { user_id: userId, type } });
    const enabled = (ch: notification_channel) => prefs.find((p) => p.channel === ch)?.enabled ?? true;

    const primary = templates.find((t) => t.channel === 'in_app') ?? templates.find((t) => t.channel === 'push') ?? templates[0];
    const base: Outgoing = {
      userId,
      type,
      title: render(primary.title_template, vars),
      body: render(primary.body_template, vars),
      deepLink: extra.deepLink,
      data: extra.data,
    };

    await this.prisma.notifications.create({
      data: {
        user_id: userId, type, channel: 'in_app', title: base.title, body: base.body, deep_link: base.deepLink,
        data: (base.data ?? {}) as any, delivery_status: 'delivered', sent_at: new Date(),
      },
    });

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, device_tokens: { where: { is_active: true }, select: { token: true } } },
    });
    for (const t of templates.filter((t) => t.channel !== 'in_app' && enabled(t.channel))) {
      const provider = this.providers.find((p) => p.channel === t.channel);
      if (!provider || !user) continue;
      const msg = { ...base, title: render(t.title_template, vars), body: render(t.body_template, vars) };
      const row = await this.prisma.notifications.create({
        data: { user_id: userId, type, channel: t.channel, title: msg.title, body: msg.body, deep_link: msg.deepLink, data: (msg.data ?? {}) as any },
      });
      try {
        await provider.send({ userId, email: user.email, phone: user.phone, tokens: user.device_tokens.map((d) => d.token) }, msg);
        await this.prisma.notifications.update({ where: { id: row.id }, data: { delivery_status: 'sent', sent_at: new Date() } });
      } catch (e: any) {
        await this.prisma.notifications.update({ where: { id: row.id }, data: { delivery_status: 'failed', failure_reason: String(e?.message ?? e) } });
      }
    }
  }

  /** Plain in-app notification (seller, rider and admin events that have no template). */
  async inApp(userId: bigint, type: notification_type, title: string, body: string, deepLink?: string) {
    await this.prisma.notifications.create({
      data: { user_id: userId, type, channel: 'in_app', title, body, deep_link: deepLink, data: {}, delivery_status: 'delivered', sent_at: new Date() },
    });
  }

  // ------------------------------------------------------------- inbox
  async list(userId: bigint, page: number, limit: number, unreadOnly = false) {
    const where = { user_id: userId, channel: 'in_app' as const, ...(unreadOnly ? { is_read: false } : {}) };
    const [total, rows, unread] = await this.prisma.$transaction([
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notifications.count({ where: { user_id: userId, channel: 'in_app', is_read: false } }),
    ]);
    return {
      ...paged(
        rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, deepLink: r.deep_link, imageUrl: r.image_url, isRead: r.is_read, createdAt: r.created_at, data: r.data })),
        total, page, limit,
      ),
      unread,
    };
  }

  async unreadCount(userId: bigint) {
    return { unread: await this.prisma.notifications.count({ where: { user_id: userId, channel: 'in_app', is_read: false } }) };
  }

  async markRead(userId: bigint, id?: bigint) {
    await this.prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false, ...(id ? { id } : {}) },
      data: { is_read: true, read_at: new Date() },
    });
    return this.unreadCount(userId);
  }

  // ------------------------------------------------------------- preferences
  static TYPES: notification_type[] = ['order', 'shipment', 'payment', 'promotion', 'account'];
  static CHANNELS: notification_channel[] = ['push', 'email', 'sms'];

  async preferences(userId: bigint) {
    const rows = await this.prisma.notification_preferences.findMany({ where: { user_id: userId } });
    return NotificationsService.TYPES.map((type) => ({
      type,
      channels: NotificationsService.CHANNELS.map((channel) => ({
        channel,
        enabled: rows.find((r) => r.type === type && r.channel === channel)?.enabled ?? true,
      })),
    }));
  }

  async setPreference(userId: bigint, type: notification_type, channel: notification_channel, enabled: boolean) {
    await this.prisma.notification_preferences.upsert({
      where: { user_id_type_channel: { user_id: userId, type, channel } },
      create: { user_id: userId, type, channel, enabled },
      update: { enabled },
    });
    return this.preferences(userId);
  }

  async registerDevice(userId: bigint, token: string, platform: 'android' | 'ios' | 'web', appVersion?: string) {
    await this.prisma.device_tokens.upsert({
      where: { token },
      create: { user_id: userId, token, platform, app_version: appVersion },
      update: { user_id: userId, is_active: true, last_seen_at: new Date(), app_version: appVersion },
    });
  }
}
