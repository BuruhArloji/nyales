import { NyalesApi, type DeviceSession, type Identity } from './api';

export type VerifiedAccount = { subject: string; getIdToken: () => Promise<string> };
export interface SessionStore {
  read(subject: string): Promise<DeviceSession | null>;
  save(subject: string, session: DeviceSession): Promise<void>;
  clear(): Promise<void>;
}

/** Google/Firebase integration supplies verified-account tokens. Account identity is
 * checked again after each asynchronous request to avoid crossing account sessions. */
export class MobileSession {
  private session: DeviceSession | null = null;
  private account: VerifiedAccount | null = null;
  private generation = 0;
  readonly api: NyalesApi;

  constructor(origin: string, private readonly store: SessionStore) {
    this.api = new NyalesApi(origin, async () => {
      const account = this.account, generation = this.generation;
      if (!account) return { idToken: '' };
      const idToken = await account.getIdToken();
      if (generation !== this.generation || account !== this.account) throw new Error('ACCOUNT_CHANGED');
      return { idToken, deviceSession: this.session?.session_token };
    });
  }

  async open(account: VerifiedAccount, deviceId: string): Promise<Identity> {
    if (!account.subject || !deviceId) throw new Error('INVALID_SESSION_INPUT');
    const generation = ++this.generation;
    this.account = account;
    this.session = null;
    const ensureCurrent = () => { if (generation !== this.generation || this.account !== account) throw new Error('ACCOUNT_CHANGED'); };
    try {
      const saved = await this.store.read(account.subject); ensureCurrent();
      this.session = saved;
      if (!this.session) {
        const result = await this.api.createDeviceSession(deviceId); ensureCurrent();
        await this.store.save(account.subject, result.data); ensureCurrent();
        this.session = result.data;
      }
      const identity = await this.api.me(); ensureCurrent();
      return identity.data;
    } catch (error) {
      if (generation === this.generation) { this.account = null; this.session = null; }
      throw error;
    }
  }

  /** Local logout does not claim to revoke the remote session. */
  async clearLocal() {
    ++this.generation;
    this.account = null;
    this.session = null;
    await this.store.clear();
  }
}
