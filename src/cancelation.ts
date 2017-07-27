import { Option } from './utils';

export default class CancelationError extends Error {
  public readonly name: string = 'CancelationError';

  constructor(public readonly reason: any = null) {
    super(reason ? `Task canceled: ${reason}` : 'Task canceled.');
  }
}

export function isCancelation(error: Error): error is CancelationError {
  return error instanceof CancelationError;
}
