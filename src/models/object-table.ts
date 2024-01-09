import { assert } from "../assert";
import { BaseReader, ReadIntMethod } from "../base-reader";
import { bplistMagicNumber, versionByteLength } from "../constants/magic-number";
import { Marker, byteToMarker, markerPrimitives } from "../markers";
import { ObjectTableOffset } from "../types/bplist-index-aliases";
import { ObjectTableArrayOrSet, ObjectTableEntry } from "./object-table-entries";
import { Trailer } from "./trailer";

export class ObjectTable extends BaseReader {

  readonly objectTableOffset: number;

  private readonly _table = new Map<ObjectTableOffset, ObjectTableEntry>();

  constructor(buffer: ArrayBuffer, trailer: Trailer, version: string) {
    super();

    const offsetTableOffset = Number(trailer.offsetTableOffset);
    const objectRefSize = trailer.objectRefSize;

    this.objectTableOffset = bplistMagicNumber.length + versionByteLength;
    let currentOffset = this.objectTableOffset;

    this._table = new Map();
    while (currentOffset < offsetTableOffset) {
      const result = ObjectTable.parseObjectTableEntry(buffer, currentOffset, version, objectRefSize);
      if (!result) {
        currentOffset++;
        continue;
      }
      const { entry, bytesRead } = result;

      this._table.set(currentOffset, entry);
      currentOffset += bytesRead;
    }

    if (currentOffset !== offsetTableOffset) {
      console.warn('End of object table should be equal to offsetTableOffset', { currentOffset, offsetTableOffset });
    }
  }

  getEntryByObjectTableOffset(offset: ObjectTableOffset) {
    const result = this._table.get(offset);
    assert(result !== undefined, `Offset ${offset} not in table`);
    return result;
  }

  static parseObjectTableEntry(
    buffer: ArrayBuffer,
    offset: number,
    version: string,
    objectRefSize: number,
  ): { entry: ObjectTableEntry, bytesRead: number } {
    const markerByte = Number(this.readInt(buffer, offset, 1, ReadIntMethod.unsigned));
    const markerParts = byteToMarker(markerByte, {} as any);

    assert(markerParts, `invalid marker byte ${markerByte}`);
    const { marker, lowerNibble } = markerParts;
    console.debug('DBG: offset=%s found marker=%s with lowerNibble=0x%s', offset, Marker[marker], lowerNibble.toString(16))

    if (markerPrimitives.has(marker)) {
      return {
        entry: markerPrimitives.get(marker)!,
        bytesRead: 1,
      }
    }

    const dynamicIntMethod = version === '00' ? ReadIntMethod.v00 : ReadIntMethod.unsigned;

    let bytesRead = 1;
    let entry: ObjectTableEntry;

    switch (marker) {
      case Marker.int: {
        const result = this.readDynamicInt(buffer, offset, dynamicIntMethod);
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
        // allegedly bytes is always 8, YET I've come across instances where it's
        const bytes = 2 ** lowerNibble;
        if (bytes !== 8) {
          console.warn('Non-spec date; should be 8-bytes but is %d as lowerNibble is %s; that is fine though', bytes, lowerNibble.toString(16));
        }
        entry = this.readDate(buffer, offset + bytesRead, bytes);
        bytesRead += bytes;
        break;
      }

      case Marker.data: {
        let bytes = lowerNibble;
        if (lowerNibble === 0xF) {
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, dynamicIntMethod);
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
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, dynamicIntMethod);
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
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, dynamicIntMethod);
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
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, dynamicIntMethod);
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
          const byteCheck = this.readDynamicInt(buffer, offset + bytesRead, dynamicIntMethod);
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
}
