
export class AssertError extends Error {
  readonly name = 'AssertError';

  constructor(message: string, readonly assertion?: any) {
    super(message);
  }
}

export function assert(assertion: any, message: string): asserts assertion {
  if (!assertion) {
    throw new AssertError(message);
  }
}
