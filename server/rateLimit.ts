// Fixed daily windows, per IP and global. State lives in memory, so it resets
// when a serverless instance is recycled; that is acceptable for a demo whose
// real cost ceiling is the API spend limit.

interface Options {
  perIpPerDay: number;
  globalPerDay: number;
  now?: () => number;
}

type Verdict = { ok: true } | { ok: false; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export class RateLimiter {
  private day = -1;
  private global = 0;
  private perIp = new Map<string, number>();
  private readonly options: Required<Options>;

  constructor(options: Options) {
    this.options = { now: Date.now, ...options };
  }

  take(ip: string): Verdict {
    const today = Math.floor(this.options.now() / DAY_MS);
    if (today !== this.day) {
      this.day = today;
      this.global = 0;
      this.perIp.clear();
    }

    if (this.global >= this.options.globalPerDay) {
      return { ok: false, message: 'The demo has reached its daily limit. The examples still work, and it resets tomorrow.' };
    }
    const used = this.perIp.get(ip) ?? 0;
    if (used >= this.options.perIpPerDay) {
      return { ok: false, message: `You have used today's ${this.options.perIpPerDay} generations. The examples still work.` };
    }

    this.perIp.set(ip, used + 1);
    this.global += 1;
    return { ok: true };
  }
}
