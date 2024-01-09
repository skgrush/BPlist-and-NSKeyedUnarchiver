export class Trailer {
  constructor(
    readonly sortVersion: number,
    readonly offsetIntSize: number,
    readonly objectRefSize: number,
    readonly numObjects: BigInt,
    readonly topObject: BigInt,
    readonly offsetTableOffset: BigInt,
    readonly _trailerOffset: number,
  ) { }
}
