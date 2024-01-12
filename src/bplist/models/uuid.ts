
export class Uuid {
  private readonly _str: string;

  constructor(
    readonly value: bigint,
  ) {
    this._str = Uuid.toFormattedHex(value);
  }

  inspect() {
    this.toString();
  }

  toString() {
    return `Uuid<${this._str}>`;
  }

  static toFormattedHex(uuid: bigint) {
    let runningRemainder = uuid;

    // 12 3e 45 67 - e8 9b - 12 d3 - a4 56 - 42 66 14 17 40 00

    const last6 = runningRemainder & 0xFF_FF_FF_FF_FF_FFn;
    runningRemainder >>= (8n * 6n);

    const leastMid = runningRemainder & 0xFF_FFn;
    runningRemainder >>= (16n);

    const midMid = runningRemainder & 0xFF_FFn;
    runningRemainder >>= (16n);

    const mostMid = runningRemainder & 0xFF_FFn;
    runningRemainder >>= (16n);

    const first4 = runningRemainder;

    return `${toHex(first4)}-${toHex(mostMid)}-${toHex(midMid)}-${toHex(leastMid)}-${toHex(last6)}`;
  }
}

const toHex = (s: bigint) => s.toString(16);
