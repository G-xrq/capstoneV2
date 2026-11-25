/**
 * Shared Maintenance Schedule & Pre-Maintenance Freeze Window helpers.
 * Keeps MaintenanceGuardModal, CampaignCard, and OrganizationView 100% in sync
 * with backend evaluateMaintenanceRuntime() and checkMaintenanceGuard().
 */

export const PRE_MAINT_FREEZE_MS = 60 * 1000; // Final 60 seconds before Effective From

export function parseMaintTimeMs(isoVal, displayVal) {
  for (const v of [isoVal, displayVal]) {
    if (!v || typeof v !== 'string' || !v.trim()) continue;
    const ms = Date.parse(v.trim());
    if (!isNaN(ms)) return ms;
  }
  return null;
}

export function getMaintenanceStatusSnapshot(maint, nowMs = Date.now()) {
  if (!maint || !maint.enabled) {
    return {
      enabled: false,
      isActiveNow: false,
      isScheduledFuture: false,
      isPreFreeze: false,
      isEndReached: false,
      startsInMs: null,
      endsInMs: null,
      startMs: null,
      endMs: null
    };
  }

  const startMs = parseMaintTimeMs(maint.startTimeIso, maint.startTime);
  const endMs = parseMaintTimeMs(maint.endTimeIso, maint.endTime);
  const autoDeactivate = maint.autoDeactivate !== false;
  const isEndReached = Boolean(autoDeactivate && endMs && nowMs >= endMs);
  const isScheduledFuture = Boolean(!isEndReached && startMs && nowMs < startMs);
  const isActiveNow = Boolean(!isEndReached && (!startMs || nowMs >= startMs));
  const startsInMs = isScheduledFuture ? Math.max(0, startMs - nowMs) : null;
  const endsInMs = endMs ? Math.max(0, endMs - nowMs) : null;
  const isPreFreeze = Boolean(
    isScheduledFuture && startsInMs !== null && startsInMs <= PRE_MAINT_FREEZE_MS
  );

  return {
    enabled: true,
    isActiveNow,
    isScheduledFuture,
    isPreFreeze,
    isEndReached,
    startsInMs,
    endsInMs,
    startMs,
    endMs
  };
}

export function isScopeBlockedNow(
  maint,
  scopesToMatch = [],
  nowMs = Date.now(),
  { includePreFreeze = true } = {}
) {
  const snap = getMaintenanceStatusSnapshot(maint, nowMs);
  if (!snap.enabled) return { blocked: false, reason: null, snap };

  const scopes = Array.isArray(maint.scope) ? maint.scope : [];
  const isFull = scopes.length === 0 || scopes.includes('FULL_PLATFORM');
  const matches = isFull || scopesToMatch.some((s) => scopes.includes(s));
  if (!matches) return { blocked: false, reason: null, snap };

  if (snap.isActiveNow) return { blocked: true, reason: 'ACTIVE', snap };
  if (includePreFreeze && snap.isPreFreeze) return { blocked: true, reason: 'PRE_FREEZE', snap };
  return { blocked: false, reason: null, snap };
}
