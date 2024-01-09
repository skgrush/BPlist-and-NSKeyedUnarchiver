import { cfAbsoluteTimeEpochMilliseconds } from "./constants/epoch";
import { AcceptedBitLength, deStructWith, getDeStructReaderBySize } from "./de-struct";
import { Marker, byteToMarker } from "./markers";
import { ObjectTableDict } from "./models/object-table-entries";
import { Uid } from "./models/uid";

export enum ReadIntMethod {
  unsigned = 1,
  signed = 2,
  v00 = 4,
}

export class BaseReader {

  /**
   * First byte must be a {@link Marker.int} which determines the rest of size of the int.
   * Reads the marker byte and the rest of the int, returns the int, and the total number of bytes read.
   */
  static readDynamicInt(buffer: ArrayBuffer, offset: number, method: ReadIntMethod) {
    const markerByte = Number(this.readInt(buffer, offset, 1, ReadIntMethod.unsigned));

    const markerParts = byteToMarker(markerByte, {} as any);
    if (markerParts?.marker !== Marker.int) {
      throw new Error(`dynamic int was not an int, was ${markerParts?.marker}`);
    }
    const bytes = 2 ** markerParts.lowerNibble;
    const entry = this.readInt(buffer, offset + 1, bytes, method);
    return {
      entry,
      bytesRead: bytes + 1
    };
  }

  /**
   * According to the comments in CFBinaryPList.c, in version='00', ints of size
   * 1|2|4 are always unsigned while ints of size 8|16 are always signed.
   */
  static readInt(buffer: ArrayBuffer, offset: number, bytes: number, method: ReadIntMethod) {
    const view = new DataView(buffer, offset, bytes);
    let bits = bytes * 8 as AcceptedBitLength;

    if (bits !== 8 && bits !== 16 && bits !== 32 && bits !== 64 && bits !== 128) {
      throw new RangeError(`Unexpected byte length for int: ${bytes}`);
    }

    if (method === ReadIntMethod.v00 && (bits == 64 || bits === 128)) {
      bits = -bits as AcceptedBitLength;
    }
    else if (method === ReadIntMethod.signed) {
      bits = -bits as AcceptedBitLength;
    }
    /// else if (method === ReadIntMethod.unsigned) { default; }

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
