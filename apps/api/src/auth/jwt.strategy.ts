import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth.decorators';

export const AUTH_COOKIE = 'access_token';

const fromCookie = (req: Request) => req?.cookies?.[AUTH_COOKIE] ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      // Web uses an httpOnly cookie; mobile apps / other clients send a Bearer token.
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), fromCookie]),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; role: string }): Promise<AuthUser> {
    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, role: true, email: true, full_name: true, status: true },
    });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    return { id: user.id, role: user.role, email: user.email, name: user.full_name };
  }
}
