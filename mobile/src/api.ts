/** Network transport for authenticated NYALES endpoints. The caller owns token refresh
 * and secure storage. This module never persists credentials or logs request bodies. */
export class NyalesApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'NyalesApiError';
  }
}

export type Credentials = { idToken: string; deviceSession?: string };
export type AuthProvider = () => Promise<Credentials>;
export type Envelope<T> = { data: T; meta?: Record<string, unknown> };
export type Identity = { id: string; organization_id: string; name?: string; role?: string; channel?: 'field' | 'telesales' | null };
export type DeviceSession = { id: string; session_token: string; version: number };
export type Customer = { id: string; name: string; address?: string | null; status?: string | null };
export type CustomerPage = { rows: Customer[]; total: number; offset: number; limit: number };
export type Overview = { period: string; actual_net_minor: number; target_net_minor: number | null; achievement: number | null; active_customer_count: number; sales_rep_count: number };
export type WorkKind = 'work-plans' | 'activities' | 'tasks' | 'invoices';
export type WorkPage = { rows: Record<string, unknown>[]; offset: number; hasMore: boolean };
export type PerformanceKind = 'targets' | 'incentive-statements';

export class NyalesApi {
  private readonly origin: string;
  constructor(baseUrl: string, private readonly credentials: AuthProvider) {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname))) {
      throw new Error('NYALES API requires HTTPS outside local development');
    }
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid API origin');
    this.origin = url.origin;
  }
  async request<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
    if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('\\')) throw new Error('Invalid API path');
    const url = new URL(path, this.origin);
    if (url.origin !== this.origin || !url.pathname.startsWith('/api/')) throw new Error('Invalid API path');
    const credentials = await this.credentials();
    if (!credentials.idToken) throw new NyalesApiError('AUTH_REQUIRED', 401);
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${credentials.idToken}`);
    if (credentials.deviceSession) headers.set('X-Device-Session', credentials.deviceSession);
    const response = await fetch(url.toString(), { ...options, headers, redirect: 'error' });
    const body = await response.json().catch(() => null) as { code?: unknown; data?: unknown } | null;
    if (!response.ok) throw new NyalesApiError(typeof body?.code === 'string' ? body.code : 'REQUEST_FAILED', response.status);
    if (!body || typeof body !== 'object' || !('data' in body)) throw new NyalesApiError('INVALID_RESPONSE', response.status);
    return body as Envelope<T>;
  }
  createDeviceSession(deviceId: string) {
    return this.request<DeviceSession>('/api/device-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_id: deviceId }) });
  }
  me() { return this.request<Identity>('/api/me'); }
  async customer(id: string): Promise<Customer> {
    if (!id || id.length > 128) throw new Error('Invalid customer ID');
    const { data } = await this.request<Customer>(`/api/customers/${encodeURIComponent(id)}`);
    if (!data || typeof data.id !== 'string' || typeof data.name !== 'string') throw new NyalesApiError('INVALID_RESPONSE', 200);
    return data;
  }
  async overview(): Promise<Overview> {
    const { data } = await this.request<Overview>('/api/dashboard');
    if (!data || typeof data.period !== 'string' || !Number.isSafeInteger(data.actual_net_minor) ||
      !Number.isSafeInteger(data.active_customer_count) || !Number.isSafeInteger(data.sales_rep_count) ||
      !(data.target_net_minor === null || Number.isSafeInteger(data.target_net_minor)) ||
      !(data.achievement === null || typeof data.achievement === 'number' && Number.isFinite(data.achievement))) {
      throw new NyalesApiError('INVALID_RESPONSE', 200);
    }
    return data;
  }
  async workPage(kind: WorkKind, offset = 0): Promise<WorkPage> {
    if (!['work-plans', 'activities', 'tasks', 'invoices'].includes(kind) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new Error('Invalid work page');
    const { data, meta } = await this.request<Record<string, unknown>[]>(`/api/${kind}?limit=50&offset=${offset}`);
    const pagination = meta?.pagination as Record<string, unknown> | undefined;
    if (!Array.isArray(data) || !data.every(row => row && typeof row === 'object' && typeof row.id === 'string') ||
      data.length > 50 || pagination?.limit !== 50 || pagination?.offset !== offset || typeof pagination?.has_more !== 'boolean') {
      throw new NyalesApiError('INVALID_RESPONSE', 200);
    }
    return { rows: data, offset, hasMore: pagination.has_more };
  }
  /** Existing server endpoints return full scoped lists; call only on demand. */
  async performance(kind: PerformanceKind, period?: string): Promise<Record<string, unknown>[]> {
    if (kind !== 'targets' && kind !== 'incentive-statements') throw new Error('Invalid performance section');
    if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid period');
    const query = kind === 'targets' && period ? `?period_start=${period}-01` : '';
    const { data } = await this.request<Record<string, unknown>[]>(`/api/${kind}${query}`);
    if (!Array.isArray(data) || !data.every(row => row && typeof row === 'object' && typeof row.id === 'string')) throw new NyalesApiError('INVALID_RESPONSE', 200);
    return data;
  }
  async customers(offset = 0, query = '', channel: 'field' | 'telesales' = 'field'): Promise<CustomerPage> {
    if (!Number.isSafeInteger(offset) || offset < 0 || query.length > 200 || !['field', 'telesales'].includes(channel)) throw new Error('Invalid customer filter');
    const params = new URLSearchParams({ limit: '50', offset: String(offset), channel });
    if (query.trim()) params.set('q', query.trim());
    const response = await this.request<Customer[]>(`/api/customers?${params}`);
    const { total, limit, offset: pageOffset } = response.meta || {};
    if (!Array.isArray(response.data) || !response.data.every(row => row && typeof row.id === 'string' && typeof row.name === 'string') ||
        !Number.isSafeInteger(total) || !Number.isSafeInteger(limit) || !Number.isSafeInteger(pageOffset) ||
        (total as number) < 0 || limit !== 50 || pageOffset !== offset || response.data.length > 50) {
      throw new NyalesApiError('INVALID_RESPONSE', 200);
    }
    return { rows: response.data, total: total as number, limit, offset: pageOffset };
  }
}

export type VisitFix = {
  occurred_at: string; captured_at?: string; latitude_e7: number | null;
  longitude_e7: number | null; accuracy_cm: number | null;
  source: 'android_gps' | 'permission_denied' | 'unavailable';
  reason: string; notes: string;
  outcome?: 'productive' | 'follow_up' | 'closed' | 'no_pic' | 'no_need';
  next_action?: { title: string; due_at: string };
};
export type LocationCheck = { status: string; distance_m: number | null; radius_m: number; accuracy_m: number | null; can_check_in: boolean; requires_reason: boolean; location_verified: boolean };
function visitPath(id: string, suffix: string) {
  if (!id || id.length > 128) throw new Error('Invalid visit ID');
  return `/api/visits/${encodeURIComponent(id)}/${suffix}`;
}
export async function checkVisitLocation(api: NyalesApi, id: string, fix: Required<Pick<VisitFix, 'latitude_e7' | 'longitude_e7' | 'accuracy_cm' | 'captured_at'>>) {
  if (fix.latitude_e7 === null || fix.longitude_e7 === null || fix.accuracy_cm === null) throw new Error('GPS fix required');
  const query = new URLSearchParams({ latitude_e7: String(fix.latitude_e7), longitude_e7: String(fix.longitude_e7), accuracy_cm: String(fix.accuracy_cm), captured_at: fix.captured_at, source: 'android_gps' });
  return api.request<LocationCheck>(`${visitPath(id, 'location-check')}?${query}`);
}
/** Reuse the same idempotency key and payload when retrying an event. */
export async function submitVisitEvent<T>(api: NyalesApi, id: string, action: 'check-in' | 'check-out', fix: VisitFix, version: number, eventId: string) {
  if (!Number.isInteger(version) || version < 1 || eventId.length < 8 || eventId.length > 128) throw new Error('Invalid event identity');
  return api.request<T>(visitPath(id, action), { method: 'POST', headers: { 'Content-Type': 'application/json', 'If-Match': `"${version}"`, 'Idempotency-Key': eventId }, body: JSON.stringify(fix) });
}
