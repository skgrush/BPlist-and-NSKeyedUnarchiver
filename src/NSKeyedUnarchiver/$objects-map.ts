import { Uid } from "@skgrush/bplist-and-nskeyedunarchiver/bplist";
import { IArchivedObject } from "./types/archive-types";

export class $ObjectsMap {
  constructor(private readonly $objects: readonly IArchivedObject[]) { }

  getByUid(uid: Uid) {
    if (uid.value === 0n) {
      return null;
    }
    const item = this.$objects[Number(uid.value)];
    if (item === undefined) {
      throw new RangeError(`'item not found for Uid<${uid.value}>'`);
    }

    return item;
  }
}
