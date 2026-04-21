// Mock crypto.randomUUID for consistent test IDs when not available
if (typeof (globalThis as Record<string, unknown>)['crypto'] === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => '00000000-0000-0000-0000-000000000000' },
  })
}
