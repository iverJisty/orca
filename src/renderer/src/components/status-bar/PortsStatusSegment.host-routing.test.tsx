// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspacePort, WorkspacePortScanResult } from '../../../../shared/workspace-ports'

const { popoverHandle, runWorkspacePortScanForTargetMock, storeState } = vi.hoisted(() => {
  const storeState = {
    settings: { activeRuntimeEnvironmentId: null as string | null },
    activeWorktreeId: 'runtime-repo::/srv/app',
    workspacePortScan: null as { key: string; result: WorkspacePortScanResult } | null,
    workspacePortScansByKey: {} as Record<string, WorkspacePortScanResult>,
    workspacePortScanRefreshing: false,
    runtimeEnvironments: [] as { id: string; name: string }[],
    recordFeatureInteraction: vi.fn(),
    setWorkspacePortScanForKey:
      vi.fn<(key: string, result: WorkspacePortScanResult | null) => void>(),
    setWorkspacePortScanProjection:
      vi.fn<(projection: { key: string; result: WorkspacePortScanResult } | null) => void>()
  }
  // Why: the real store writes back. Bare spies let a publish and the notice
  // that reads it drift onto different scan keys with every assertion green.
  storeState.setWorkspacePortScanForKey.mockImplementation((key, result) => {
    const next = { ...storeState.workspacePortScansByKey }
    if (result) {
      next[key] = result
    } else {
      delete next[key]
    }
    storeState.workspacePortScansByKey = next
  })
  storeState.setWorkspacePortScanProjection.mockImplementation((projection) => {
    storeState.workspacePortScan = projection
  })
  return {
    popoverHandle: { onOpenChange: null as ((open: boolean) => void) | null },
    runWorkspacePortScanForTargetMock: vi.fn(),
    storeState
  }
})

vi.mock('@/store', () => {
  const useAppStore = Object.assign(
    (selector: (state: typeof storeState) => unknown) => selector(storeState),
    { getState: () => storeState }
  )
  return { useAppStore }
})

vi.mock('@/lib/worktree-runtime-owner', () => ({
  getRuntimeEnvironmentIdForWorktree: (_state: unknown, worktreeId: string | null | undefined) =>
    worktreeId === 'runtime-repo::/srv/app' ? 'env-1' : null
}))

vi.mock('@/runtime/runtime-rpc-client', async () => {
  const actual = await import('@/runtime/runtime-client-target')
  return {
    getActiveRuntimeTarget: actual.getActiveRuntimeTarget,
    callRuntimeRpc: vi.fn(),
    assertRuntimeEnvironmentCapability: vi.fn(),
    RuntimeRpcCallError: class RuntimeRpcCallError extends Error {
      code?: string
    }
  }
})

vi.mock('@/lib/workspace-port-scan-client', () => ({
  runWorkspacePortScanForTarget: runWorkspacePortScanForTargetMock
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({
    children,
    onOpenChange
  }: {
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
  }) => {
    popoverHandle.onOpenChange = onOpenChange
    return <>{children}</>
  },
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@/components/SelectedTextCopyMenu', () => ({
  SelectedTextCopyMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('./ports-status-popover-rows', () => ({
  PortRow: () => <div data-testid="port-row" />,
  WorkspaceGroupRows: () => <div data-testid="workspace-group-rows" />
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, unknown>) =>
    options
      ? fallback.replace(/{{(\w+)}}/g, (_match, name: string) => String(options[name] ?? ''))
      : fallback
}))

import { PortsStatusSegment } from './PortsStatusSegment'

function workspacePort(overrides: Partial<WorkspacePort> & { port: number; id: string }) {
  return {
    bindHost: '0.0.0.0',
    connectHost: '127.0.0.1',
    port: overrides.port,
    id: overrides.id,
    pid: 4321,
    processName: 'node',
    protocol: 'http' as const,
    kind: 'workspace' as const,
    owner: {
      worktreeId: 'runtime-repo::/srv/app',
      repoId: 'runtime-repo',
      displayName: 'runtime app',
      path: '/srv/app',
      confidence: 'cwd' as const
    }
  }
}

const localHostScan: WorkspacePortScanResult = {
  platform: 'linux',
  scannedAt: 10,
  ports: [workspacePort({ id: 'local-5173', port: 5173 })]
}

const remoteHostScan: WorkspacePortScanResult = {
  platform: 'linux',
  scannedAt: 20,
  ports: [workspacePort({ id: 'remote-3000', port: 3000 })]
}

describe('PortsStatusSegment popover host routing', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    popoverHandle.onOpenChange = null
    storeState.settings = { activeRuntimeEnvironmentId: null }
    storeState.activeWorktreeId = 'runtime-repo::/srv/app'
    storeState.workspacePortScan = null
    storeState.workspacePortScansByKey = { 'local:all': localHostScan }
    storeState.runtimeEnvironments = [{ id: 'env-1', name: 'linux-box' }]
    storeState.recordFeatureInteraction.mockClear()
    storeState.setWorkspacePortScanForKey.mockClear()
    storeState.setWorkspacePortScanProjection.mockClear()
    runWorkspacePortScanForTargetMock.mockReset()
    runWorkspacePortScanForTargetMock.mockResolvedValue(remoteHostScan)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root.render(<PortsStatusSegment iconOnly={false} />)
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  async function openPopover(): Promise<void> {
    await act(async () => {
      popoverHandle.onOpenChange?.(true)
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("scans the active workspace's host, not the globally focused runtime", async () => {
    await openPopover()

    expect(runWorkspacePortScanForTargetMock).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      undefined
    )
    expect(storeState.setWorkspacePortScanForKey).toHaveBeenCalledWith(
      'environment:env-1:all',
      remoteHostScan
    )
  })

  it('keeps other hosts in the projection instead of overwriting it with one host', async () => {
    await openPopover()

    expect(storeState.setWorkspacePortScanProjection).toHaveBeenCalledWith({
      key: 'all-hosts:all',
      result: expect.objectContaining({
        ports: expect.arrayContaining([
          expect.objectContaining({ port: 5173 }),
          expect.objectContaining({ port: 3000 })
        ])
      })
    })
  })

  it('publishes a failed scan under its own host without dropping other hosts', async () => {
    runWorkspacePortScanForTargetMock.mockRejectedValueOnce(new Error('remote scan failed'))

    await openPopover()

    const [projection] = storeState.setWorkspacePortScanProjection.mock.calls.at(-1) as [
      { key: string; result: WorkspacePortScanResult }
    ]
    expect(projection.key).toBe('all-hosts:all')
    expect(projection.result.ports).toEqual([expect.objectContaining({ port: 5173 })])
    expect(storeState.setWorkspacePortScanForKey).toHaveBeenCalledWith(
      'environment:env-1:all',
      expect.objectContaining({ unavailableReason: 'remote scan failed' })
    )
  })

  // Why: separate tests already cover "the failure is stored" and "a stored
  // failure renders". Only this one proves both halves name the same scan key.
  it('surfaces the host it just failed to scan on the next render', async () => {
    runWorkspacePortScanForTargetMock.mockRejectedValueOnce(new Error('remote scan failed'))

    await openPopover()
    act(() => {
      root.render(<PortsStatusSegment iconOnly={false} />)
    })

    expect(container.textContent).toContain(
      'Port scan unavailable on linux-box: remote scan failed'
    )
  })

  it('names the host whose scan failed while another host still reports ports', () => {
    act(() => {
      root.unmount()
    })
    storeState.workspacePortScansByKey = {
      'local:all': localHostScan,
      'environment:env-1:all': {
        platform: 'linux',
        scannedAt: 30,
        ports: [],
        unavailableReason: 'Remote connection dropped'
      }
    }
    storeState.workspacePortScan = { key: 'all-hosts:all', result: localHostScan }
    root = createRoot(container)
    act(() => {
      root.render(<PortsStatusSegment iconOnly={false} />)
    })

    expect(container.textContent).toContain(
      'Port scan unavailable on linux-box: Remote connection dropped'
    )
    // The notice sits above the list rather than replacing it: a reachable
    // host's count still renders.
    expect(container.textContent).toContain('1 workspace')
  })

  it('stays on the local host when the active workspace has no runtime owner', async () => {
    act(() => {
      root.unmount()
    })
    storeState.activeWorktreeId = 'local-repo::/home/dev/app'
    root = createRoot(container)
    act(() => {
      root.render(<PortsStatusSegment iconOnly={false} />)
    })

    await openPopover()

    expect(runWorkspacePortScanForTargetMock).toHaveBeenCalledWith({ kind: 'local' }, undefined)
    expect(storeState.setWorkspacePortScanProjection).toHaveBeenCalledWith({
      key: 'local:all',
      result: remoteHostScan
    })
  })
})
