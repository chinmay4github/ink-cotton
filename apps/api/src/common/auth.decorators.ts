import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { user_role } from '../generated/prisma/enums';

export interface AuthUser {
  id: bigint;
  role: user_role;
  email?: string | null;
  name: string;
}

export const IS_PUBLIC = 'isPublic';
/** Route is reachable without a token (a token, if sent, is still decoded). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Restrict a route to one or more roles. Every phase (vendor, admin, delivery) reuses this. */
export const Roles = (...roles: user_role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
