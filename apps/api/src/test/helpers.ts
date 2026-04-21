import { vi } from 'vitest'
import type { AuthContext } from '@kvalt/shared'
import type { Db } from '../db/client.js'

export const mockAdmin: AuthContext = {
  userId: 'user-admin-1',
  companyId: 'company-1',
  role: 'ADMIN',
  zitadelUserId: 'zitadel-admin-1',
  zitadelOrgId: 'org-1',
}

export const mockForeman: AuthContext = {
  userId: 'user-foreman-1',
  companyId: 'company-1',
  role: 'FOREMAN',
  zitadelUserId: 'zitadel-foreman-1',
  zitadelOrgId: 'org-1',
}

export const mockWorker: AuthContext = {
  userId: 'user-worker-1',
  companyId: 'company-1',
  role: 'WORKER',
  zitadelUserId: 'zitadel-worker-1',
  zitadelOrgId: 'org-1',
}

export function returning(rows: unknown[]) {
  return { returning: vi.fn().mockResolvedValue(rows) }
}

export function selectChain(rows: unknown[]) {
  const p = Promise.resolve(rows)
  const node: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  node.limit = vi.fn().mockResolvedValue(rows)
  node.orderBy = vi.fn().mockReturnValue(node)
  node.where = vi.fn().mockReturnValue(node)
  node.innerJoin = vi.fn().mockReturnValue(node)
  node.leftJoin = vi.fn().mockReturnValue(node)
  node.offset = vi.fn().mockReturnValue(node)
  return { from: vi.fn().mockReturnValue(node) }
}

export function updateChain(returned: unknown[] = []) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(returned) }),
    }),
  }
}

export function deleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) }
}

export function makeDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as Db
}
