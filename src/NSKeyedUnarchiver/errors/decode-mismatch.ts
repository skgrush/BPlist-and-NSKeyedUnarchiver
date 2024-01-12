
export class DecodeMismatch extends Error {
  constructor(readonly key: string, readonly expectedType: string, readonly actual: any) {
    super(`For key ${key}: expected ${expectedType} but found ${actual}`);
  }
}
