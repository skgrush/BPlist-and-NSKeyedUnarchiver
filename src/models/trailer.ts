export class Trailer {
  constructor(
    readonly sortVersion: number,
    /** size of offsets found in offsetTable that point to objects in object table */
    readonly offsetIntSize: number,
    /** size of objectRefs that are found in arrays/sets/dicts */
    readonly objectRefSize: number,
    readonly numObjects: BigInt,
    readonly topObject: BigInt,
    readonly offsetTableOffset: BigInt,
    readonly _trailerOffset: number,
  ) { }
}
