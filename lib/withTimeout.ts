export class TimeoutError extends Error {
  constructor(message = "timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof TimeoutError || (error instanceof Error && error.name === "TimeoutError");
}

/** Rejects if `promise` is still pending after `ms`. The original work is not cancelled. */
export function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
