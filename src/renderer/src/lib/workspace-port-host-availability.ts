import type { WorkspacePortScanResult } from '../../../shared/workspace-ports'

export type UnavailableWorkspacePortHost = {
  scanKey: string
  /** null for the local host; otherwise the paired runtime environment's id. */
  environmentId: string | null
  reason: string
}

// Why: mirrors workspacePortScanKeyForTarget (`${targetKey}:all`, where the
// target key is `local` or `environment:<id>`) without importing the heavier
// workspace-port-actions module into this pure helper. Splitting on the last
// `:all` keeps environment ids that themselves contain colons intact.
const ENVIRONMENT_SCAN_KEY_PREFIX = 'environment:'
const SCAN_KEY_SUFFIX = ':all'

/** Runtime environment id for a per-host scan key; null for the local host or unknown shapes. */
function environmentIdForScanKey(scanKey: string): string | null {
  if (!scanKey.endsWith(SCAN_KEY_SUFFIX)) {
    return null
  }
  const targetKey = scanKey.slice(0, -SCAN_KEY_SUFFIX.length)
  if (!targetKey.startsWith(ENVIRONMENT_SCAN_KEY_PREFIX)) {
    return null
  }
  const environmentId = targetKey.slice(ENVIRONMENT_SCAN_KEY_PREFIX.length)
  return environmentId || null
}

/**
 * Hosts whose latest scan failed while another host still reported.
 * Why: the merged projection only carries `unavailableReason` when every host
 * failed, so one unreachable server would otherwise read as "that workspace has
 * no ports" — and on a remote host, "none listening" and "could not look" are
 * different answers.
 */
export function getUnavailableWorkspacePortHosts(
  scansByKey: Record<string, WorkspacePortScanResult>
): UnavailableWorkspacePortHost[] {
  const entries = Object.entries(scansByKey)
  const failed = entries.filter(([, scan]) => Boolean(scan?.unavailableReason))
  // Every host failed: the projection carries the reason and the popover already
  // renders it in place of the list.
  if (failed.length === 0 || failed.length === entries.length) {
    return []
  }
  return failed.flatMap(([scanKey, scan]) =>
    scan.unavailableReason
      ? [
          {
            scanKey,
            environmentId: environmentIdForScanKey(scanKey),
            reason: scan.unavailableReason
          }
        ]
      : []
  )
}
