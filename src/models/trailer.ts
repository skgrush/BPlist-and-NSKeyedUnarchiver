import { deStruct } from "../de-struct";

export class Trailer {
  static readonly trailerByteLength = 32;
  static readonly unusedLeadingBytes = 5;

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

  static fromBuffer(buffer: ArrayBuffer) {
    const trailerOffset = buffer.byteLength - this.trailerByteLength;
    const trailerView = new DataView(buffer, trailerOffset + this.unusedLeadingBytes);

    const [sortVersion, offsetIntSize, objectRefSize, numObjects, topObject, offsetTableOffset] = deStruct([8, 8, 8, 64, 64, 64], trailerView);
    return new Trailer(
      sortVersion,
      offsetIntSize,
      objectRefSize,
      numObjects,
      topObject,
      offsetTableOffset,
      trailerOffset,
    );
  }
}
