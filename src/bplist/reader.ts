import { BaseReader } from "./base-reader";
import { bplistMagicNumber, versionByteLength } from "./constants/magic-number";
import { Marker } from "./markers";
import { ObjectTable } from "./models/object-table";
import { ObjectTableArrayLike, ObjectTableDict, ObjectTableOutput } from "./models/object-table-entries";
import { OffsetTable } from "./models/offset-table";
import { Trailer } from "./models/trailer";
import { ObjRef } from "./types/bplist-index-aliases";
import { ILogger } from '@skgrush/bplist-and-nskeyedunarchiver/shared';

function isNotUndefined<T>(o: T): o is Exclude<T, undefined> {
  return o !== undefined;
}

export class Reader extends BaseReader {
  static readonly versionByteLength = 2;

  readonly version: string;

  readonly trailer: Trailer;
  readonly offsetTable: OffsetTable;
  readonly objectTable: ObjectTable;

  readonly logger: ILogger;

  constructor(buffer: ArrayBuffer, logger: ILogger) {
    super(logger);

    this.logger = logger;

    const magicNumber = this.readAscii(buffer, 0, bplistMagicNumber.length);
    if (magicNumber !== bplistMagicNumber) {
      throw new Error(`Invalid magicNumber (at start of file); must be ${bplistMagicNumber} but got ${JSON.stringify(magicNumber)}`);
    }
    this.version = this.readAscii(buffer, bplistMagicNumber.length, versionByteLength);
    if (this.version !== '00') {
      logger.warn('WARN: version is not 00 and will likely have issues / fail! version = %s', this.version);
    }

    this.trailer = Trailer.fromBuffer(buffer, logger);
    logger.debug('DBG: Trailer found: %O', this.trailer);
    this.offsetTable = new OffsetTable(buffer, this.trailer, logger);
    this.objectTable = new ObjectTable(buffer, this.trailer, this.version, logger);
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
    if (tableEntry instanceof ObjectTableArrayLike) {
      const elements = tableEntry.objrefs.map(r => this._buildObjectsRecursive(r, workingSet)).filter(isNotUndefined);

      output =
        tableEntry.type === Marker.array
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
        this.logger.warn('non-string keys found in pairs', pairs);
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
    const refFromOffset = this.offsetTable.getObjectTableOffsetByObjRef(offset);

    return this.objectTable.getEntryByObjectTableOffset(refFromOffset);
  }
}
