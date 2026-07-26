/**
 * Every Honeystick response carries the same envelope - `{ ok, status, body,
 * error }` - so a failure is a value, not an exception, all the way from the
 * API to here. This turns it into one thrown error with the status intact,
 * because a caller gating a feature on "usage limit reached" needs to tell a
 * 403 from a 500.
 */
export class HoneystickError extends Error {
  readonly status: number;
  readonly code: string | null;
  /** the envelope's body, when the API sent one alongside the error */
  readonly body: unknown;

  constructor({
    message,
    status,
    code = null,
    body = null,
  }: {
    message: string;
    status: number;
    code?: string | null;
    body?: unknown;
  }) {
    super(message);
    this.name = 'HoneystickError';
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** the API refused the call outright - key, org or environment is wrong */
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  /**
   * A limit stopped it rather than a fault: track-usage answers 403 with the
   * counter untouched when a feature is capped, and that is a normal branch
   * for a caller to handle, not an outage.
   */
  get isLimitReached() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

export function toHoneystickError({
  status,
  payload,
}: {
  status: number;
  payload: unknown;
}) {
  const envelope = (payload ?? {}) as {
    error?: unknown;
    body?: unknown;
    code?: string;
  };
  return new HoneystickError({
    message: errorMessage(envelope.error, `Honeystick request failed (${status})`),
    status,
    code: envelope.code ?? null,
    body: envelope.body ?? null,
  });
}
