import { describe, expect, it, vi } from 'vitest'
import {
  executeUpdateAction,
  type UpdateState,
  type UpdatesClient,
} from '../../src/settings/updatesClient'

function createClient(overrides: Partial<UpdatesClient>): UpdatesClient {
  return {
    getState: vi.fn(async () => ({ status: 'idle', currentVersion: '0.7.1' })),
    check: vi.fn(async () => ({ status: 'current', currentVersion: '0.7.1' })),
    install: vi.fn(async () => ({ status: 'installing', currentVersion: '0.7.1' })),
    subscribe: vi.fn(() => () => undefined),
    ...overrides,
  }
}

describe('updates client actions', () => {
  const current: UpdateState = { status: 'idle', currentVersion: '0.7.1' }

  it('returns the privileged action result', async () => {
    const available: UpdateState = {
      status: 'available',
      currentVersion: '0.7.1',
      availableVersion: '0.8.0',
    }

    await expect(
      executeUpdateAction(createClient({ check: vi.fn(async () => available) }), 'check', current),
    ).resolves.toEqual(available)
  })

  it('normalises privileged action failures without losing the current version', async () => {
    await expect(
      executeUpdateAction(
        createClient({ install: vi.fn(async () => Promise.reject(new Error('Signature invalid'))) }),
        'install',
        current,
      ),
    ).resolves.toEqual({
      status: 'error',
      currentVersion: '0.7.1',
      message: 'Signature invalid',
    })
  })
})
