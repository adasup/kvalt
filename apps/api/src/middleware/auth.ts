import type { MiddlewareHandler } from 'hono'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { AuthContext } from '@kvalt/shared'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'
import type { Db } from '../db/client.js'

export interface AppEnv {
  Bindings: {
    DATABASE_URL: string
    ZITADEL_DOMAIN: string
    ANTHROPIC_API_KEY: string
    KV: KVNamespace
    R2: R2Bucket
    NOTIFICATION_QUEUE: Queue
  }
  Variables: {
    auth: AuthContext
    db: Db
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks(domain: string) {
  if (!jwksCache.has(domain)) {
    jwksCache.set(domain, createRemoteJWKSet(new URL(`https://${domain}/oauth/v2/keys`)))
  }
  return jwksCache.get(domain)!
}

export function extractRoleFromPayload(payload: JWTPayload): AuthContext['role'] {
  const roles = (payload['urn:zitadel:iam:org:project:roles'] as Record<string, unknown> | undefined) ?? {}
  if ('ADMIN' in roles) return 'ADMIN'
  if ('FOREMAN' in roles) return 'FOREMAN'
  return 'WORKER'
}

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const domain = c.env.ZITADEL_DOMAIN

  try {
    const { payload } = await jwtVerify(token, getJwks(domain), {
      issuer: `https://${domain}`,
    })

    const zitadelUserId = payload.sub!
    const zitadelOrgId = (payload['urn:zitadel:iam:org:id'] as string | undefined) ?? ''

    const db = c.get('db')
    const [user] = await db
      .select({ id: users.id, companyId: users.companyId, role: users.role })
      .from(users)
      .where(eq(users.zitadelUserId, zitadelUserId))
      .limit(1)

    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    c.set('auth', {
      userId: user.id,
      companyId: user.companyId,
      role: user.role as AuthContext['role'],
      zitadelUserId,
      zitadelOrgId,
    })

    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
}

export function requireRole(...roles: AuthContext['role'][]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get('auth')
    if (!roles.includes(auth.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
