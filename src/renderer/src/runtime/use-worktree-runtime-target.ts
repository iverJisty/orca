import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import { getActiveRuntimeTarget, type RuntimeClientTarget } from './runtime-client-target'

/**
 * Runtime target that owns `worktreeId`, which is not always the globally
 * focused runtime — acting on the focused one scans the wrong host and reports
 * that workspace as having no ports.
 */
export function useWorktreeRuntimeTarget(
  worktreeId: string | null | undefined
): RuntimeClientTarget {
  const settings = useAppStore((s) => s.settings)
  const runtimeEnvironmentId = useAppStore((s) => getRuntimeEnvironmentIdForWorktree(s, worktreeId))
  return useMemo(
    () => getActiveRuntimeTarget({ ...settings, activeRuntimeEnvironmentId: runtimeEnvironmentId }),
    [runtimeEnvironmentId, settings]
  )
}
