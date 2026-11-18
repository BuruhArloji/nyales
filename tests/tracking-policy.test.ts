import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessTrackingPoint, shouldUpdateLastLocation, splitTrackingSegments, TRACKING_POLICY} from '../src/shared/tracking-policy';

const start = Date.parse('2026-11-19T01:00:00Z');
const point = {latitude: -6.2, longitude: 106.8, accuracyM: 15, capturedAtMs: start + 60_000};

test('offline points remain eligible after session stop, but recording outside a session does not', () => {
  const session = {startedAtMs: start, stoppedAtMs: start + 120_000};
  assert.equal(assessTrackingPoint(point, session, start + 86_400_000), 'valid');
  assert.equal(assessTrackingPoint({...point, capturedAtMs: start - 1}, session, start), 'outside_session');
  assert.equal(assessTrackingPoint({...point, capturedAtMs: start + 120_001}, session, start + 120_001), 'outside_session');
});

test('invalid, imprecise and future GPS fixes are identified separately', () => {
  const session = {startedAtMs: start};
  assert.equal(assessTrackingPoint({...point, latitude: 91}, session, start + 60_000), 'invalid');
  assert.equal(assessTrackingPoint({...point, accuracyM: 101}, session, start + 60_000), 'inaccurate');
  assert.equal(assessTrackingPoint({...point, capturedAtMs: start + 600_001}, session, start), 'future');
});

test('late uploads do not regress last known location', () => {
  assert.equal(shouldUpdateLastLocation(start + 100, start + 99), false);
  assert.equal(shouldUpdateLastLocation(start + 100, start + 100), false);
  assert.equal(shouldUpdateLastLocation(start + 100, start + 101), true);
});

test('lines have a gap when the signal has been missing', () => {
  const later = {...point, capturedAtMs: point.capturedAtMs + TRACKING_POLICY.staleAfterMs + 1};
  assert.deepEqual(splitTrackingSegments([later, point, {...point}]), [[point], [later]]);
});
