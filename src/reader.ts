import { assert } from "./assert";
import { cfAbsoluteTimeEpochMilliseconds } from "./constants/epoch";
import { AcceptedBitLength, deStruct, deStructWith, deStructWithIter, getDeStructReaderBySize } from "./de-struct";
import { Marker, byteToMarker, markerPrimitives } from "./markers";
import { Trailer } from "./models/trailer";

function isNotUndefined<T>(o: T): o is Exclude<T, undefined> {
  return o !== undefined;
}

class Uid {
  constructor(readonly value: bigint) { }
}

class ObjectTableArrayOrSet {
  constructor(
    readonly type: 'array' | 'set',
    readonly objrefs: readonly ObjRef[],
  ) { }
}
class ObjectTableDict {
  constructor(
    readonly entries: readonly DictKeyValue[],
  ) { }
}

/** whole-file offset into the object table */
type ObjectTableOffset = number & {};
/** index of the offset table */
type ObjRef = number & {};

type DictKeyValue = readonly [key: ObjRef, value: ObjRef];
type ObjectTableEntry = null | false | true | number | bigint | Date | Blob | string | Uid | ObjectTableDict | ObjectTableArrayOrSet;
type ObjectTableOutput = null | boolean | number | bigint | Date | Blob | string | Uid | readonly ObjectTableOutput[] | ReadonlySet<ObjectTableOutput> | { readonly [k: string]: ObjectTableOutput };

export class Reader {
  static readonly magicNumber = 'bplist';
  static readonly magicNumberLength = this.magicNumber.length;
  static readonly versionByteLength = 2;
  // readonly buffer: ArrayBuffer;

  readonly version: string;

  readonly trailer: Trailer;
  /** maps object-reference offsets to full-file-offsets pointing to objects */
  readonly offsetTable: readonly ObjectTableOffset[]; //ReadonlyMap<OffsetTableOffset, ObjectTableOffset>;
  readonly objectTable: ReadonlyMap<ObjectTableOffset, ObjectTableEntry>;

  constructor(buffer: ArrayBuffer) {
    const magicNumber = Reader.readAscii(buffer, 0, Reader.magicNumberLength);
    if (magicNumber !== Reader.magicNumber) {
      throw new Error(`Invalid magicNumber (at start of file); must be ${Reader.magicNumber} but got ${JSON.stringify(magicNumber)}`);
    }
    this.version = Reader.readAscii(buffer, Reader.magicNumberLength, Reader.versionByteLength);

    // this.buffer = buffer;
    this.trailer = Reader.getTrailer(buffer);
    console.debug('Trailer found: %O', this.trailer);
    this.offsetTable = Reader.getOffsetTable(buffer, this.trailer);
    this.objectTable = Reader.getObjectTable(buffer, this.trailer, this.version);
  }

  buildTopLevelObject() {
    const topOffset = Number(this.trailer.topObject);

    return this._buildObjectsRecursive(topOffset, undefined);
  }

  private _buildObjectsRecursive(offset: ObjRef, workingSet: undefined | Map<ObjRef, ObjectTableOutput>): undefined | ObjectTableOutput {
    workingSet ??= new Map();

    const existingOutput = workingSet.get(offset);
    if (existingOutput) {
      return existingOutput;
    }

    const tableEntry = this.getObjectEntryByObjRef(offset);
    if (tableEntry === undefined) {
      return undefined;
    }

    let output: ObjectTableOutput;
    if (tableEntry instanceof ObjectTableArrayOrSet) {
      const elements = tableEntry.objrefs.map(r => this._buildObjectsRecursive(r, workingSet)).filter(isNotUndefined);

      output =
        tableEntry.type === 'array'
          ? Object.freeze(elements)
          : new Set(elements);
    }
    else if (tableEntry instanceof ObjectTableDict) {
      const pairs = tableEntry.entries
        .map(([key, value]) => {
          const keyOutput = this._buildObjectsRecursive(key, workingSet);
          const valueOutput = this._buildObjectsRecursive(value, workingSet);
          if (keyOutput === undefined || valueOutput === undefined) {
            return undefined;
          }
          return [keyOutput, valueOutput] as const;
        })
        .filter(isNotUndefined);

      if (pairs.some(([k]) => typeof k !== 'string')) {
        console.warn('non-string keys found in pairs', pairs);
      }

      output = Object.freeze(
        Object.fromEntries(pairs),
      );
    }
    else {
      output = tableEntry;
    }

    workingSet.set(offset, output);
    return output;
  }

  getObjectEntryByObjRef(offset: ObjRef) {
    const refFromOffset = this.offsetTable[offset];
    if (refFromOffset === undefined) {
      console.warn('Offset', offset, 'not found in offset table');
      return undefined;
    }
    return this.getObjectEntryByOffset(refFromOffset);
  }

  getObjectEntryByOffset(ref: ObjectTableOffset) {
    const entry = this.objectTable.get(ref);
    if (entry === undefined) {
      console.warn('ObjectRef', ref, 'not found in object table');
      return undefined;
    }
    return entry;
  }

  static getOffsetTable(buffer: ArrayBuffer, trailer: Trailer): readonly ObjectTableOffset[] {
    const { offsetTableOffset, offsetIntSize } = trailer;
    const trailerOffset = trailer._trailerOffset;
    const offsetTableByteSize = trailerOffset - Number(offsetTableOffset);
    const offsetTableCount = offsetTableByteSize / offsetIntSize;

    assert(() => (offsetTableCount | 0) === offsetTableCount, `OffsetTable count must be an integer`);

    const offsetBitLength = offsetIntSize * 8;
    if (offsetBitLength !== 8 && offsetBitLength !== 16 && offsetBitLength !== 32) {
      throw new RangeError(`Unexpected offsetIntSize: ${offsetIntSize}`);
    }
    const readerFn = getDeStructReaderBySize(offsetBitLength);
    const readerFns = Array(offsetTableCount).fill(readerFn) as Array<typeof readerFn>;

    const offsetTableView = new DataView(buffer, Number(offsetTableOffset), offsetTableByteSize);

    const map = deStructWith(readerFns, offsetTableView);

    return map;
  }

  static getObjectTable(buffer: ArrayBuffer, trailer: Trailer, version: string) {
    const offsetTableOffset = Number(trailer.offsetTableOffset);
    const objectRefSize = trailer.objectRefSize;

    const objectTableOffset = Reader.magicNumberLength + Reader.versionByteLength;

    let currentOffset = objectTableOffset;

    const table = new Map<ObjectTableOffset, ObjectTableEntry>();
    while (currentOffset < offsetTableOffset) {
      const result = this.parseObjectTableEntry(buffer, currentOffset, version, objectRefSize);
      if (!result) {
        currentOffset++;
        continue;
      }
      const { entry, bytesRead } = result;

      table.set(currentOffset, entry);
      currentOffset += bytesRead;
    }

    if (currentOffset !== offsetTableOffset) {
      console.warn('End of object table should be equal to offsetTableOffset', { currentOffset, offsetTableOffset });
    }

    return table;
  }

  static parseObjectTableEntry(
    buffer: ArrayBuffer,
    offset: number,
    version: string,
    objectRefSize: number,
  ): { entry: ObjectTableEntry, bytesRead: number } | undefined {
    const markerByte = Number(this.readInt(buffer, offset, 1, version));
    const markerParts = byteToMarker(markerByte, {} as any);
    if (!markerParts) {
      // error already logged in byteToMarker
      return undefined;
    }
    const { marker, lowerNibble } = markerParts;
    console.debug('DBG: offset=%s found marker=%s with lowerNibble=0x%s', offset, Marker[marker], lowerNibble.toString(16))

    if (markerPrimitives.has(marker)) {
      return {
        entry: markerPrimitives.get(marker)!,
        bytesRead: 1,
      }
    }

    let bytesRead = 1;
    let entry: ObjectTableEntry;

    switch (marker) {
      case Marker.int: {
        const result = this.readDynamicInt(buffer, offset, version);
        entry = result.entry;
        bytesRead += result.bytesRead - 1; // re-read first byte
        break;
      }

      case Marker.real: {
        const bytes = 2 ** lowerNibble;
        entry = this.readReal(buffer, offset + bytesRead, bytes);
        bytesRead += bytes;
        break;
      }

      case Marker.date: {
        const bytes = 2 ** lowerNibble;
        if (bytes !== 8) {
          // throw new RangeError(`Unexpected date size not 8: ${bytes}`);
        }
        entry = this.readDate(buffer, offset + bytesRead, bytes);
        bytesRead += bytes;
        break;
      }

      case Marker.data: {
        let bytes = lowerNibble;
        if (lowerNibble === 0xF) {
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, version);
          bytes = Number(byteCheck.entry);
          bytesRead += byteCheck.bytesRead;
        }
        entry = this.readData(buffer, offset, bytes);
        bytesRead += bytes;
        break;
      }

      case Marker.ascii: {
        let bytes = lowerNibble;
        if (lowerNibble === 0xF) {
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, version);
          bytes = Number(byteCheck.entry);
          bytesRead += byteCheck.bytesRead;
        }
        entry = this.readAscii(buffer, offset + bytesRead, bytes);
        bytesRead += bytes;
        break;
      }

      case Marker.unicode: {
        let charCount = lowerNibble;
        if (lowerNibble === 0xF) {
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, version);
          charCount = Number(byteCheck.entry);
          bytesRead += byteCheck.bytesRead;
        }
        entry = this.readUnicode16(buffer, offset + bytesRead, charCount);
        bytesRead += charCount * 2;
        break;
      }

      case Marker.uid: {
        const bytes = lowerNibble + 1;
        entry = this.readUid(buffer, offset + bytesRead, bytes);
        bytesRead += bytes;
        break;
      }

      case Marker.array: {
        let size = lowerNibble;
        if (lowerNibble === 0xF) {
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, version);
          size = Number(byteCheck.entry);
          bytesRead += byteCheck.bytesRead;
        }
        entry = new ObjectTableArrayOrSet(
          'array',
          this.readArrayObjRefs(buffer, offset + bytesRead, size, objectRefSize),
        );
        bytesRead += size * objectRefSize;
        break;
      }

      case Marker.set: {
        let size = lowerNibble;
        if (lowerNibble === 0xF) {
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, version);
          size = Number(byteCheck.entry);
          bytesRead += byteCheck.bytesRead;
        }
        entry = new ObjectTableArrayOrSet(
          'set',
          this.readArrayObjRefs(buffer, offset + bytesRead, size, objectRefSize),
        );
        bytesRead += size * objectRefSize;
        break;
      }

      case Marker.dict: {
        let size = lowerNibble;
        if (lowerNibble === 0xF) {
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, version);
          size = Number(byteCheck.entry);
          bytesRead += byteCheck.bytesRead;
        }
        entry = this.readDictObjRefs(buffer, offset + bytesRead, size, objectRefSize);
        bytesRead += size * objectRefSize * 2;
        break;
      }

      default:
        throw new Error(); // should be covered in byteToMarker
    }

    console.debug('DBG: offset=%d done, read %d bytes and found %O', offset, bytesRead, entry);

    return {
      entry,
      bytesRead,
    }
  }

  static getTrailer(buffer: ArrayBuffer) {
    const trailerByteLength = 32;
    const unusedLeadingBytes = 5;
    const trailerOffset = buffer.byteLength - trailerByteLength;
    const trailerView = new DataView(buffer, trailerOffset + unusedLeadingBytes);

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

  static readDynamicInt(buffer: ArrayBuffer, offset: number, version: string) {
    const markerByte = Number(this.readInt(buffer, offset, 1, version));
    const markerParts = byteToMarker(markerByte, {} as any);
    if (markerParts?.marker !== Marker.int) {
      throw new Error(`dynamic int was not an int, was ${markerParts?.marker}`);
    }
    const bytes = 2 ** markerParts.lowerNibble;
    const entry = this.readInt(buffer, offset + 1, bytes, version);
    return {
      entry,
      bytesRead: bytes + 1
    };
  }

  /**
   * According to the comments in CFBinaryPList.c, in version='00', ints of size
   * 1|2|4 are always unsigned while ints of size 8|16 are always signed.
   */
  static readInt(buffer: ArrayBuffer, offset: number, bytes: number, version: string) {
    const view = new DataView(buffer, offset, bytes);
    let bits = bytes * 8 as AcceptedBitLength;

    if (bits !== 8 && bits !== 16 && bits !== 32 && bits !== 64 && bits !== 128) {
      throw new RangeError(`Unexpected byte length for int: ${bytes}`);
    }

    if (version === '00' && (bits == 64 || bits === 128)) {
      bits = -bits as AcceptedBitLength;
    }

    const reader = getDeStructReaderBySize(bits);
    return BigInt(reader(view, 0).value);
  }

  static readReal(buffer: ArrayBuffer, offset: number, bytes: number) {
    const view = new DataView(buffer, offset, bytes);
    switch (bytes) {
      case 4:
        return view.getFloat32(0);
      case 8:
        return view.getFloat64(0);
    }

    throw new RangeError(`Unexpected byte length for real: ${bytes}`);
  }

  static readDate(buffer: ArrayBuffer, offset: number, bytes: number) {
    const secondsSinceEpoch = this.readReal(buffer, offset, bytes);

    const utcMilliseconds = cfAbsoluteTimeEpochMilliseconds + secondsSinceEpoch * 1e3;
    return new Date(utcMilliseconds);
  }

  static readData(buffer: ArrayBuffer, offset: number, size: number) {
    return new Blob([buffer.slice(offset, offset + size)]);
  }

  /**
   * TODO: are we 100% sure that 8-bit ASCII is the correct encoding?
   */
  static readAscii(buffer: ArrayBuffer, offset: number, bytes: number) {
    const byteArray = new Uint8Array(buffer, offset, bytes);

    return String.fromCharCode.apply(null, byteArray as any);
  }

  static readUnicode16(buffer: ArrayBuffer, offset: number, count: number) {
    // damn you little-endian; if Uint16Array were bigendian we could just read that
    const byteLength = count * 2;
    const dataView = new DataView(buffer, offset, byteLength);

    return String.fromCharCode.apply(null, [
      ...(function* () {
        for (let i = 0; i < byteLength; i += 2) {
          yield dataView.getUint16(i);
        }
      })()
    ]);
  }

  static readUid(buffer: ArrayBuffer, offset: number, bytes: number) {
    const bits = bytes * 8;
    if (bits !== 8 && bits !== 16 && bits !== 32 && bits !== 64) {
      throw new RangeError(`Unexpected byte length for UID: ${bytes}`);
    }

    const dataView = new DataView(buffer, offset, bytes);
    return new Uid(BigInt(getDeStructReaderBySize(bits)(dataView, 0).value));
  }

  static readArrayObjRefs(buffer: ArrayBuffer, offset: number, count: number, objectRefSize: number) {
    // damn you little-endian; if UintXXArray were bigendian we could just read that
    const byteLength = count * objectRefSize;
    const dataView = new DataView(buffer, offset, byteLength);

    const objectRefBitSize = objectRefSize * 8;
    if (objectRefBitSize !== 8 && objectRefBitSize !== 16 && objectRefBitSize !== 32) {
      throw new RangeError(`Unexpected objectRefSize: ${objectRefBitSize}`);
    }

    const fn = getDeStructReaderBySize(objectRefBitSize);
    const fnArray = Array(count).fill(fn) as Array<typeof fn>;

    return deStructWith(fnArray, dataView);
  }

  static readDictObjRefs(buffer: ArrayBuffer, offset: number, count: number, objectRefSize: number): ObjectTableDict {
    const byteLength = count * objectRefSize * 2;
    const dataView = new DataView(buffer, offset, byteLength);

    const objectRefBitSize = objectRefSize * 8;
    if (objectRefBitSize !== 8 && objectRefBitSize !== 16 && objectRefBitSize !== 32) {
      throw new RangeError(`Unexpected objectRefSize: ${objectRefBitSize}`);
    }

    const fn = getDeStructReaderBySize(objectRefBitSize);
    const fnArray = Array(count * 2).fill(fn) as Array<typeof fn>;

    const keysAndObjs = deStructWith(fnArray, dataView);

    return new ObjectTableDict([
      ...(function* () {
        for (let i = 0; i < count; ++i) {
          yield [keysAndObjs[i], keysAndObjs[i + count]] as const;
        }
      })()
    ]);
  }
}
