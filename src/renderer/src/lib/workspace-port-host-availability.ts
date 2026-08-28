import type { WorkspacePortScanResult } from '../../../shared/workspace-ports'

export type UnavailableWorkspacePortHost = {
  scanKey: string
  /** null for the local host; otherwise the paired runtime environment's id. */
  environmentId: string | null
  reason: string
}

const ENVIRONMENT_SCAN_KEY = /^environment:(.+):all$/

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
            environmentId: ENVIRONMENT_SCAN_KEY.exec(scanKey)?.[1] ?? null,
            reason: scan.unavailableReason
          }
        ]
      : []
  )
}
