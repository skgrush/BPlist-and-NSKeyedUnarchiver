import { ObjRef } from "../types/bplist-index-aliases";
import { Uid } from "./uid";

export class ObjectTableArrayOrSet {
  constructor(
    readonly type: 'array' | 'set',
    readonly objrefs: readonly ObjRef[],
  ) { }
}

type DictKeyValue = readonly [key: ObjRef, value: ObjRef];
export class ObjectTableDict {
  constructor(
    readonly entries: readonly DictKeyValue[],
  ) { }
}

export type ObjectTableEntry = null | false | true | number | bigint | Date | Blob | string | Uid | ObjectTableDict | ObjectTableArrayOrSet;
export type ObjectTableOutput = null | boolean | number | bigint | Date | Blob | string | Uid | readonly ObjectTableOutput[] | ReadonlySet<ObjectTableOutput> | { readonly [k: string]: ObjectTableOutput };
