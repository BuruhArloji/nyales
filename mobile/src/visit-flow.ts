import { checkVisitLocation, submitVisitEvent, type LocationCheck, type NyalesApi, type VisitFix } from './api';
import { captureVisitLocation, type LocationResult } from './location';

export type PreparedVisit = { action: 'check-in' | 'check-out'; visitId: string; version: number; location: LocationResult; assessment: LocationCheck | null };

/** Preparation may request GPS permission and read the server policy. It never
 * submits a visit; the user must explicitly confirm in the UI. */
export async function prepareVisit(api: NyalesApi, visitId: string, version: number, action: 'check-in' | 'check-out'): Promise<PreparedVisit> {
  const location = await captureVisitLocation();
  if (location.kind !== 'fix') return { action, visitId, version, location, assessment: null };
  const { latitude_e7, longitude_e7, accuracy_cm, captured_at } = location.fix;
  if (latitude_e7 === null || longitude_e7 === null || accuracy_cm === null || !captured_at) throw new Error('Invalid GPS fix');
  const result = await checkVisitLocation(api, visitId, { latitude_e7, longitude_e7, accuracy_cm, captured_at });
  return { action, visitId, version, location, assessment: result.data };
}

/** Does not generate an event key: callers must retain the same key and payload
 * until the server acknowledges it, including across retries. */
export async function confirmPreparedVisit<T>(api: NyalesApi, prepared: PreparedVisit, input: { eventId: string; occurredAt: string; reason: string; notes: string; outcome?: VisitFix['outcome']; nextAction?: VisitFix['next_action'] }) {
  if (prepared.action === 'check-in' && prepared.assessment && !prepared.assessment.can_check_in) throw new Error('CHECK_IN_NOT_ALLOWED');
  const needsReason = !prepared.assessment || prepared.assessment.requires_reason;
  if (needsReason && !input.reason.trim()) throw new Error('LOCATION_REASON_REQUIRED');
  if (prepared.action === 'check-out' && !input.outcome) throw new Error('OUTCOME_REQUIRED');
  if (prepared.action === 'check-out' && !input.notes.trim()) throw new Error('NOTES_REQUIRED');
  if (prepared.action === 'check-out' && input.outcome && ['follow_up','no_pic','closed'].includes(input.outcome) && (!input.nextAction?.title.trim() || !input.nextAction?.due_at || !Number.isFinite(Date.parse(input.nextAction.due_at)))) throw new Error('NEXT_ACTION_REQUIRED');
  const fix: VisitFix = prepared.location.kind === 'fix'
    ? { ...prepared.location.fix, occurred_at: input.occurredAt, reason: input.reason, notes: input.notes }
    : { source: prepared.location.kind === 'denied' ? 'permission_denied' : 'unavailable', latitude_e7: null, longitude_e7: null, accuracy_cm: null, occurred_at: input.occurredAt, reason: input.reason, notes: input.notes };
  if (input.outcome) fix.outcome = input.outcome;
  if (input.nextAction) fix.next_action = input.nextAction;
  return submitVisitEvent<T>(api, prepared.visitId, prepared.action, fix, prepared.version, input.eventId);
}
