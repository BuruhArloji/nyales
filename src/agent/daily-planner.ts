import {z} from 'zod';
import {visitSnapshot, visitGeneratorPolicy, visitResult, type VisitResult} from '../shared/visit-generator';
import {inspectVisitCandidate} from '../server/visit-generator-protocol';
import {agentSha256} from '../shared/visit-agent-proof';
import {canonicalJson} from '../shared/boundaries';
import {osrmMatrixRequest, parseOsrmMatrix, matrixCacheKey} from './osrm-client';
import {solveDaily} from './daily-solver';

type Matrix = ReturnType<typeof parseOsrmMatrix> & {cache_key: string};
type MatrixRequest = z.infer<typeof osrmMatrixRequest>;
type Rejection = VisitResult['unscheduled'][number];
type Context = {
  python: string;
  matrix: (request: MatrixRequest, signal?: AbortSignal) => Promise<Matrix>;
  routing_profile: string;
  signal?: AbortSignal;
  matrix_provenance: 'synthetic_fixture' | 'operator_osrm_unverified';
};
const byteLength = (value: unknown) => new TextEncoder().encode(canonicalJson(value)).length;

/** Draft computation only. Executable and matrix provider belong to the operator, never the job. */
export async function computeDailyCandidate(rawSnapshot: unknown, rawPolicy: unknown, context: Context) {
  context.signal?.throwIfAborted();
  const snapshot = visitSnapshot.parse(rawSnapshot), policy = visitGeneratorPolicy.parse(rawPolicy);
  if (snapshot.request.mode !== 'daily' || snapshot.rep_days.length !== 1) throw Error('DAILY_SINGLE_REP_DAY_REQUIRED');
  if (await agentSha256(canonicalJson(policy)) !== snapshot.policy_sha256) throw Error('DAILY_POLICY_HASH_MISMATCH');
  const day = snapshot.rep_days[0], base = Date.parse(day.shift.from);
  const horizon = (Date.parse(day.shift.until) - base) / 1000;
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 86400) throw Error('DAILY_SHIFT_INVALID');
  // A time-only obstacle would ignore the journey to an existing appointment.
  if (snapshot.protected_agenda.length) throw Error('DAILY_PROTECTED_AGENDA_REQUIRES_LOCKED_LOCATION_INTEGRATION');
  if (snapshot.occurrences.some(o => o.locked_appointment)) throw Error('DAILY_LOCKED_APPOINTMENT_MODEL_PENDING');
  if (new Set(snapshot.occurrences.map(o => o.customer_id)).size !== snapshot.occurrences.length)
    throw Error('DAILY_DUPLICATE_CUSTOMER_OCCURRENCE');

  const rejected: Rejection[] = [], eligible: typeof snapshot.occurrences = [];
  for (const o of snapshot.occurrences) {
    let reason: Rejection['code'] | null = null;
    if (!o.point) reason = 'missing_coordinates';
    else if (o.service_seconds === null) reason = 'missing_service_duration';
    else if (!o.windows.length) reason = 'missing_opening_hours';
    else if (!o.eligible_rep_day_ids.includes(day.id)) reason = 'missing_assignment';
    else if (o.missing_fields.length) reason = ('missing_' + o.missing_fields[0]) as Rejection['code'];
    else if (o.last_completed_date && Date.parse(day.date) - Date.parse(o.last_completed_date) < o.minimum_gap_days * 86400000)
      reason = 'hard_constraints_infeasible';
    if (reason) {
      rejected.push({occurrence_id: o.id, code: reason, detail: 'Explicit source or hard constraint prevents this occurrence from entering the daily solver.'});
    } else eligible.push(o);
  }
  if (eligible.length + 2 > policy.runtime.max_matrix_nodes || eligible.length > 98)
    throw Error('DAILY_MATRIX_NODE_LIMIT_NARROW_SELECTION');
  const nodes = [{id: 'start:' + day.id, ...day.start}, ...eligible.map(o => ({id: o.id, ...o.point!})), {id: 'end:' + day.id, ...day.end}];
  const request = osrmMatrixRequest.parse({graph: snapshot.graph, routing_profile: context.routing_profile, maximum_snap_metres: policy.runtime.maximum_snap_metres, nodes});
  const matrixStart = performance.now(), matrix = await context.matrix(request, context.signal);
  const matrixWall = Math.ceil(performance.now() - matrixStart);
  // Revalidate a provider's normalized matrix, including snapped coordinate order,
  // diagonals, bounds, fallback denial, graph/profile identity and cache identity.
  const checked = parseOsrmMatrix({code: 'Ok', durations: matrix.durations_seconds, distances: matrix.distances_metres,
    sources: matrix.snapped_sources.map(p => ({location: p.location, distance: p.distance_metres})),
    destinations: matrix.snapped_destinations.map(p => ({location: p.location, distance: p.distance_metres})),
    ...(matrix.source_data_version === null ? {} : {data_version: matrix.source_data_version})}, request);
  const cacheKey = await matrixCacheKey(request);
  if (canonicalJson(matrix) !== canonicalJson({...checked, cache_key: cacheKey})) throw Error('DAILY_MATRIX_REFERENCE_MISMATCH');
  if (matrix.durations_seconds.some(row => row.some(v => v !== null && v > 604800)) ||
      matrix.distances_metres.some(row => row.some(v => v !== null && v > 10000000))) throw Error('DAILY_MATRIX_EDGE_INVALID');

  const relative = (instant: string) => (Date.parse(instant) - base) / 1000;
  const solverInput = {format: 'nyales-daily-solver-1', horizon_seconds: horizon,
    solver_seconds: Math.min(120, policy.runtime.solver_seconds), capacity_service_seconds: day.capacity_service_seconds,
    travel_weight_basis_points: policy.weights.travel_cost,
    breaks: day.breaks.map(b => [relative(b.from), relative(b.until)]),
    visits: eligible.map(o => ({id: o.id, service_seconds: o.service_seconds!,
      windows: o.windows.map(w => [Math.max(0, relative(w.from)), Math.min(horizon, relative(w.until))]).filter(([a,b]) => b > a),
      required: o.obligation === 'required', priority: o.priority_basis_points})), durations_seconds: matrix.durations_seconds};
  if (solverInput.visits.some(v => !v.windows.length)) throw Error('DAILY_WINDOW_OUTSIDE_SHIFT');
  const solution = await solveDaily(context.python, solverInput, {signal: context.signal});
  const at = (n: number) => new Date(base + n * 1000).toISOString();
  const snapshotSha = await agentSha256(canonicalJson(snapshot)), matrixSha = await agentSha256(canonicalJson(matrix));
  const candidate = ['feasible','timeout_with_candidate'].includes(solution.outcome);
  const route = candidate ? {rep_day_id: day.id, ordered_occurrence_ids: solution.visits.map(v => v.id),
    visits: solution.visits.map(v => ({occurrence_id: v.id, travel_departure_at: at(v.travel_departure_seconds),
      arrival_at: at(v.arrival_seconds), service_start_at: at(v.service_start_seconds), departure_at: at(v.departure_seconds),
      travel_from_previous_seconds: v.travel_seconds, travel_from_previous_metres: matrix.distances_metres[v.matrix_from][v.matrix_to]!})),
    return_departure_at: at(solution.return_departure_seconds!), return_travel_seconds: solution.return_travel_seconds!,
    return_travel_metres: matrix.distances_metres[solution.visits.at(-1)?.matrix_to || 0][nodes.length - 1]!,
    return_at: at(solution.return_at_seconds!), matrix_manifest_id: matrixSha} : null;
  const result = visitResult.parse({contract_version: 'nyales-visit-generator-1', job_id: snapshot.job_id,
    snapshot_sha256: snapshotSha, graph_sha256: snapshot.graph.graph_sha256, policy_sha256: snapshot.policy_sha256,
    solver_outcome: solution.outcome, optimality: 'not_claimed', routes: route ? [route] : [],
    unscheduled: [...rejected, ...solution.unscheduled.map(v => ({occurrence_id: v.id, code: v.code,
      detail: 'Daily road-matrix and hard time/service constraints did not schedule this occurrence.'}))],
    hard_violations: [], soft_penalties: [],
    assumptions_disclosed: snapshot.occurrences.flatMap(o => o.assumptions.map(a => ({occurrence_id: o.id, field: a.field, reason: a.reason}))),
    measured: {solver_wall_ms: solution.wall_ms, matrix_wall_ms: matrixWall, peak_memory_bytes: solution.peak_memory_bytes,
      source_bytes: byteLength(snapshot), result_bytes: 0}});
  // The byte count is part of its own JSON; converge rather than count a placeholder.
  while (result.measured.result_bytes !== byteLength(result)) result.measured.result_bytes = byteLength(result);
  const validation = inspectVisitCandidate(snapshot, result, snapshotSha);
  return {format: 'nyales-daily-candidate-1', snapshot_sha256: snapshotSha, matrix_sha256: matrixSha,
    matrix_provenance: context.matrix_provenance, osrm_process_identity_verified: false as const,
    objective: {formula: 'sum(prepared_priority_basis_points * shift_seconds) - travel_weight_basis_points * road_travel_seconds',
      prepared_priority_source: 'frozen_snapshot', travel_weight_basis_points: policy.weights.travel_cost},
    matrix, result, validation, publishable: false as const, engine_version: solution.engine_version};
}
