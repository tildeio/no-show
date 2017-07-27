export type Option<T> = T | null;

export function isObject(obj: any): obj is Object {
  return typeof obj === 'object' && obj !== null;
}

export function isFunction(obj: any): obj is Function {
  return typeof obj === 'function';
}

class AssertionFailed extends Error {
  constructor(message?: string) {
    super(message ? `Assertion failed: ${message}` : 'Assertion failed.');
  }
}

/* TODO: use babel-plugin-debug-macros */
export function assert(cond: any, message?: string) {
  if (!cond) throw new AssertionFailed(message);
}

