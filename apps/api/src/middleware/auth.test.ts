import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware, requireRole, extractRoleFromPayload } from './auth.js'
import type { AppEnv } from './auth.js'

// ─── Mock jose ────────────────────────────────────────────────────────────────

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn(),
}))

import { jwtVerify } from 'jose'
const mockJwtVerify = vi.mocked(jwtVerify)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DOMAIN = 'kvalt.zitadel.cloud'

const adminPayload = {
  sub: 'zitadel-admin-1',
  'urn:zitadel:iam:org:id': 'org-abc',
  'urn:zitadel:iam:org:project:roles': { ADMIN: { 'org-abc': 'org-abc' } },
}

const foremanPayload = {
  sub: 'zitadel-foreman-1',
  'urn:zitadel:iam:org:id': 'org-abc',
  'urn:zitadel:iam:org:project:roles': { FOREMAN: { 'org-abc': 'org-abc' } },
}

const workerPayload = {
  sub: 'zitadel-worker-1',
  'urn:zitadel:iam:org:id': 'org-abc',
  'urn:zitadel:iam:org:project:roles': {},
}

function makeMockDb(user: { id: string; companyId: string; role: string } | null) {
  const limit = vi.fn().mockResolvedValue(user ? [user] : [])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })
  return { select, from, where, limit }
}

function createApp(mockDb: ReturnType<typeof makeMockDb>) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', mockDb as never)
    await next()
  })
  app.use('*', authMiddleware)
  app.get('/test', (c) => c.json({ auth: c.get('auth') }))
  return app
}

function makeEnv(): AppEnv['Bindings'] {
  return { ZITADEL_DOMAIN: DOMAIN } as AppEnv['Bindings']
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const app = createApp(makeMockDb(null))
    const res = await app.request('/test', {}, makeEnv())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const app = createApp(makeMockDb(null))
    const res = await app.request('/test', {
      headers: { Authorization: 'Basic abc123' },
    }, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('JWTExpired'))
    const app = createApp(makeMockDb(null))
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer bad-token' },
    }, makeEnv())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Invalid token' })
  })

  it('returns 401 when user is not found in DB', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: adminPayload } as never)
    const app = createApp(makeMockDb(null))
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    }, makeEnv())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'User not found' })
  })

  it('sets auth context with correct userId and companyId from DB', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: adminPayload } as never)
    const mockDb = makeMockDb({ id: 'user-1', companyId: 'company-1', role: 'ADMIN' })
    const app = createApp(mockDb)

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    }, makeEnv())

    expect(res.status).toBe(200)
    const body = await res.json() as { auth: { userId: string; companyId: string } }
    expect(body.auth.userId).toBe('user-1')
    expect(body.auth.companyId).toBe('company-1')
  })

  it('maps zitadelOrgId from JWT claim to auth context', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: adminPayload } as never)
    const mockDb = makeMockDb({ id: 'user-1', companyId: 'company-1', role: 'ADMIN' })
    const app = createApp(mockDb)

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    }, makeEnv())

    const body = await res.json() as { auth: { zitadelOrgId: string; companyId: string } }
    // companyId comes from DB (linked to zitadelOrgId at registration)
    expect(body.auth.zitadelOrgId).toBe('org-abc')
    expect(body.auth.companyId).toBe('company-1')
  })

  it('looks up user by zitadelUserId from JWT sub claim', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: adminPayload } as never)
    const mockDb = makeMockDb({ id: 'user-1', companyId: 'company-1', role: 'ADMIN' })
    const app = createApp(mockDb)

    await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    }, makeEnv())

    expect(mockDb.select).toHaveBeenCalled()
  })
})

describe('extractRoleFromPayload', () => {
  it('extracts ADMIN role', () => {
    expect(extractRoleFromPayload(adminPayload)).toBe('ADMIN')
  })

  it('extracts FOREMAN role', () => {
    expect(extractRoleFromPayload(foremanPayload)).toBe('FOREMAN')
  })

  it('defaults to WORKER when no matching role', () => {
    expect(extractRoleFromPayload(workerPayload)).toBe('WORKER')
  })

  it('prefers ADMIN over FOREMAN when both present', () => {
    const payload = {
      sub: 'x',
      'urn:zitadel:iam:org:project:roles': { ADMIN: {}, FOREMAN: {} },
    }
    expect(extractRoleFromPayload(payload)).toBe('ADMIN')
  })
})

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createRoleApp(allowedRoles: ('ADMIN' | 'FOREMAN' | 'WORKER')[], userRole: string) {
    mockJwtVerify.mockResolvedValue({ payload: adminPayload } as never)
    const mockDb = makeMockDb({ id: 'user-1', companyId: 'company-1', role: userRole })
    const app = new Hono<AppEnv>()
    app.use('*', async (c, next) => {
      c.set('db', mockDb as never)
      await next()
    })
    app.use('*', authMiddleware)
    app.use('*', requireRole(...allowedRoles))
    app.get('/admin-only', (c) => c.json({ ok: true }))
    return app
  }

  it('allows ADMIN to access ADMIN-only route', async () => {
    const app = createRoleApp(['ADMIN'], 'ADMIN')
    const res = await app.request('/admin-only', {
      headers: { Authorization: 'Bearer token' },
    }, makeEnv())
    expect(res.status).toBe(200)
  })

  it('blocks WORKER from ADMIN-only route with 403', async () => {
    const app = createRoleApp(['ADMIN'], 'WORKER')
    const res = await app.request('/admin-only', {
      headers: { Authorization: 'Bearer token' },
    }, makeEnv())
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })

  it('blocks FOREMAN from ADMIN-only route with 403', async () => {
    const app = createRoleApp(['ADMIN'], 'FOREMAN')
    const res = await app.request('/admin-only', {
      headers: { Authorization: 'Bearer token' },
    }, makeEnv())
    expect(res.status).toBe(403)
  })

  it('allows both ADMIN and FOREMAN when both listed', async () => {
    const appAdmin = createRoleApp(['ADMIN', 'FOREMAN'], 'ADMIN')
    const appForeman = createRoleApp(['ADMIN', 'FOREMAN'], 'FOREMAN')

    const r1 = await appAdmin.request('/admin-only', {
      headers: { Authorization: 'Bearer token' },
    }, makeEnv())
    const r2 = await appForeman.request('/admin-only', {
      headers: { Authorization: 'Bearer token' },
    }, makeEnv())

    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
  })

  it('blocks WORKER when only ADMIN and FOREMAN are allowed', async () => {
    const app = createRoleApp(['ADMIN', 'FOREMAN'], 'WORKER')
    const res = await app.request('/admin-only', {
      headers: { Authorization: 'Bearer token' },
    }, makeEnv())
    expect(res.status).toBe(403)
  })
})
