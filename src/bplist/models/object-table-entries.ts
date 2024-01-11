import { Marker } from "../markers";
import { ObjRef } from "../types/bplist-index-aliases";
import { Uid } from "./uid";

export class ObjectTableArrayLike {
  readonly typeName: 'array' | 'set' | 'orderedSet';
  constructor(
    readonly type: Marker.array | Marker.set | Marker.orderedSet,
    readonly objrefs: readonly ObjRef[],
  ) {
    this.typeName = Marker[type] as any;
  }
}

type DictKeyValue = readonly [key: ObjRef, value: ObjRef];
export class ObjectTableDict {
  constructor(
    readonly entries: readonly DictKeyValue[],
  ) { }
}

export type ObjectTableEntry = null | false | true | number | bigint | Date | ArrayBuffer | string | Uid | ObjectTableDict | ObjectTableArrayLike;
export type ObjectTableOutput = null | boolean | number | bigint | Date | ArrayBuffer | string | Uid | readonly ObjectTableOutput[] | ReadonlySet<ObjectTableOutput> | { readonly [k: string]: ObjectTableOutput };
