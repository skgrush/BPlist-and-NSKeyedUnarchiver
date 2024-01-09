
export class AssertError extends Error {
  readonly name = 'AssertError';

  constructor(message: string, readonly assertion?: () => boolean) {
    super(message);
  }
}

export function assert(assertion: () => boolean, message: string) {
  if (!assertion()) {
    throw new AssertError(message, assertion);
  }
}
