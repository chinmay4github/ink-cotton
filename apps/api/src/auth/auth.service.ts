import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';
import { Events } from '../events/events';

const PUBLIC_USER = {
  id: true,
  role: true,
  full_name: true,
  email: true,
  phone: true,
  avatar_url: true,
  email_verified: true,
  created_at: true,
} as const;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private events: EventEmitter2) {}

  private sign(user: { id: bigint; role: string }) {
    return this.jwt.sign({ sub: user.id.toString(), role: user.role });
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.users.findFirst({
      where: { OR: [{ email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
      select: { id: true },
    });
    if (exists) throw new ConflictException('An account with this email or phone already exists');

    const user = await this.prisma.users.create({
      data: {
        full_name: dto.fullName.trim(),
        email,
        phone: dto.phone,
        password_hash: await bcrypt.hash(dto.password, 12),
        role: 'customer',
        cart: { create: {} },
      },
      select: PUBLIC_USER,
    });
    this.events.emit(Events.UserRegistered, { userId: user.id, name: user.full_name });
    return { user, token: this.sign(user) };
  }

  async login(dto: LoginDto) {
    const id = dto.identifier.trim();
    const user = await this.prisma.users.findFirst({
      where: id.includes('@') ? { email: id.toLowerCase() } : { phone: id },
    });
    // Same error for unknown user and bad password to avoid account enumeration.
    if (!user || !(await bcrypt.compare(dto.password, user.password_hash)) || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (dto.role && user.role !== dto.role) {
      const where = { customer: 'the Ink & Cotton shop', vendor: 'Ink & Cotton Sell', delivery_agent: 'Ink & Cotton Deliver', admin: 'Ink & Cotton Admin' }[user.role];
      throw new UnauthorizedException(`This account can't sign in here. Use ${where} instead.`);
    }
    await this.prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    const { password_hash, ...rest } = user;
    return { user: rest, token: this.sign(user) };
  }

  me(userId: bigint) {
    return this.prisma.users.findUniqueOrThrow({ where: { id: userId }, select: PUBLIC_USER });
  }

  async updateProfile(userId: bigint, dto: UpdateProfileDto) {
    if (dto.phone) {
      const taken = await this.prisma.users.findFirst({ where: { phone: dto.phone, NOT: { id: userId } } });
      if (taken) throw new ConflictException('Phone already in use');
    }
    return this.prisma.users.update({
      where: { id: userId },
      data: { full_name: dto.fullName, phone: dto.phone },
      select: PUBLIC_USER,
    });
  }
}
