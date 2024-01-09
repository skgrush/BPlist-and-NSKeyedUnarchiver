import { deStructWith, getDeStructReaderBySize } from "../de-struct";
import { assert } from "../assert";
import { Trailer } from "./trailer";
import { ObjRef, ObjectTableOffset } from "../types/bplist-index-aliases";

/**
 * Maps ObjRefs (indicies) to full-file-offsets pointing to objects
 */
export class OffsetTable {
  readonly offsetTableOffset: number;
  readonly offsetIntSize: number;
  readonly offsetTableByteLength: number;
  readonly count: number;

  private readonly _table: ObjectTableOffset[];

  constructor(buffer: ArrayBuffer, trailer: Trailer) {
    const { offsetTableOffset, offsetIntSize, _trailerOffset: trailerOffset } = trailer;

    this.offsetTableOffset = Number(offsetTableOffset);
    this.offsetIntSize = offsetIntSize;

    this.offsetTableByteLength = trailerOffset - this.offsetTableOffset;
    this.count = this.offsetTableByteLength / offsetIntSize;

    assert((this.count | 0) === this.count, `OffsetTable count must be an integer, got ${this.count}`);

    const offsetBitLength = offsetIntSize * 8;
    assert(offsetBitLength === 8 || offsetBitLength === 16 || offsetBitLength === 32, `Unexpected offsetIntSize: ${offsetIntSize}`);

    const readerFn = getDeStructReaderBySize(offsetBitLength);
    const readerFns = Array(this.count).fill(readerFn) as Array<typeof readerFn>;

    const offsetTableView = new DataView(buffer, Number(offsetTableOffset), this.offsetTableByteLength);

    this._table = deStructWith(readerFns, offsetTableView);
  }

  getObjectTableOffsetByObjRef(ref: ObjRef) {
    assert(ref in this._table, `Ref ${ref} not in OffsetTable`);

    return this._table[ref];
  }
}
