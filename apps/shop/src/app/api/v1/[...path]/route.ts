import { createApiProxy } from '@ic/ui/proxy';
import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, PATCH, DELETE, HEAD } = createApiProxy(SESSION_COOKIE);
