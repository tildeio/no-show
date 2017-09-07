export default class CancelationError extends Error {
  readonly name: string = 'CancelationError';

  constructor(public readonly reason: any = null) {
    super(reason ? `Task canceled: ${reason}` : 'Task canceled.');
  }
}

export function isCancelation(error: Error): error is CancelationError {
  return error instanceof CancelationError;
}
