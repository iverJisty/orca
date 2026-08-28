import { describe, expect, it } from 'vitest'
import type { WorkspacePortScanResult } from '../../../shared/workspace-ports'
import { getUnavailableWorkspacePortHosts } from './workspace-port-host-availability'

function scan(overrides: Partial<WorkspacePortScanResult> = {}): WorkspacePortScanResult {
  return { platform: 'linux', scannedAt: 1, ports: [], ...overrides }
}

describe('getUnavailableWorkspacePortHosts', () => {
  it('reports the failed host while another host still answers', () => {
    expect(
      getUnavailableWorkspacePortHosts({
        'local:all': scan(),
        'environment:env-1:all': scan({ unavailableReason: 'Remote connection dropped' })
      })
    ).toEqual([
      {
        scanKey: 'environment:env-1:all',
        environmentId: 'env-1',
        reason: 'Remote connection dropped'
      }
    ])
  })

  it('reports the local host by a null environment id', () => {
    expect(
      getUnavailableWorkspacePortHosts({
        'local:all': scan({ unavailableReason: 'lsof is unavailable' }),
        'environment:env-1:all': scan()
      })
    ).toEqual([{ scanKey: 'local:all', environmentId: null, reason: 'lsof is unavailable' }])
  })

  // Why: the merged projection carries the reason once every host failed, and the
  // popover renders that in place of the list — a second notice would duplicate it.
  it('stays silent when every tracked host failed', () => {
    expect(
      getUnavailableWorkspacePortHosts({
        'local:all': scan({ unavailableReason: 'lsof is unavailable' }),
        'environment:env-1:all': scan({ unavailableReason: 'Remote connection dropped' })
      })
    ).toEqual([])
  })

  it('stays silent for a single failed host', () => {
    expect(
      getUnavailableWorkspacePortHosts({
        'local:all': scan({ unavailableReason: 'lsof is unavailable' })
      })
    ).toEqual([])
  })

  it('stays silent when nothing failed', () => {
    expect(getUnavailableWorkspacePortHosts({ 'local:all': scan() })).toEqual([])
    expect(getUnavailableWorkspacePortHosts({})).toEqual([])
  })
})
