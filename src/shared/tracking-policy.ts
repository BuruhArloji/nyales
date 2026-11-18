/** Pure tracking policy. Device scheduling and server authorisation remain separate. */
export const TRACKING_POLICY = Object.freeze({
  targetIntervalMs: 60_000,
  stationaryIntervalMs: 300_000,
  batchIntervalMs: 300_000,
  maxBatchPoints: 100,
  maxAccuracyM: 100,
  staleAfterMs: 600_000,
  maxFutureSkewMs: 300_000,
  detailRetentionDays: 30,
  summaryRetentionMonths: 3,
});

export interface TrackingPoint {
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAtMs: number;
}

export type PointAssessment = 'valid' | 'invalid' | 'inaccurate' | 'future' | 'outside_session';

/** Assessment is deliberately independent of arrival time: offline points may arrive later. */
export function assessTrackingPoint(point: TrackingPoint, session: {startedAtMs: number; stoppedAtMs?: number}, receivedAtMs: number): PointAssessment {
  if (![point.latitude, point.longitude, point.accuracyM, point.capturedAtMs, session.startedAtMs, receivedAtMs].every(Number.isFinite)
    || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 || point.accuracyM < 0
    || (session.stoppedAtMs !== undefined && (!Number.isFinite(session.stoppedAtMs) || session.stoppedAtMs < session.startedAtMs))) return 'invalid';
  if (point.capturedAtMs > receivedAtMs + TRACKING_POLICY.maxFutureSkewMs) return 'future';
  if (point.capturedAtMs < session.startedAtMs || (session.stoppedAtMs !== undefined && point.capturedAtMs > session.stoppedAtMs)) return 'outside_session';
  if (point.accuracyM > TRACKING_POLICY.maxAccuracyM) return 'inaccurate';
  return 'valid';
}

/** A delayed offline upload must never move the current marker backwards. */
export function shouldUpdateLastLocation(currentCapturedAtMs: number | null, candidateCapturedAtMs: number): boolean {
  return Number.isFinite(candidateCapturedAtMs) && (currentCapturedAtMs === null || candidateCapturedAtMs > currentCapturedAtMs);
}

/** Avoid drawing a continuous line over periods without location data. */
export function splitTrackingSegments(points: readonly TrackingPoint[], maxGapMs = TRACKING_POLICY.staleAfterMs): TrackingPoint[][] {
  if (!Number.isFinite(maxGapMs) || maxGapMs <= 0) throw new RangeError('maxGapMs must be positive');
  const sorted = [...points].sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  const segments: TrackingPoint[][] = [];
  const seen = new Set<string>();
  for (const point of sorted) {
    const key=`${point.capturedAtMs}:${point.latitude}:${point.longitude}`;
    if(seen.has(key))continue;
    seen.add(key);
    const last = segments.at(-1);
    if (!last || point.capturedAtMs - last[last.length - 1].capturedAtMs > maxGapMs) segments.push([point]);
    else last.push(point);
  }
  return segments;
}
