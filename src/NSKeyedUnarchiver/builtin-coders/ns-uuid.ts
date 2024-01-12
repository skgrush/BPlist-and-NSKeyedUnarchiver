// import { Uuid, deStruct } from "@skgrush/bplist-and-nskeyedunarchiver/bplist";
import { Uuid, deStruct } from '../../bplist';
import { $ObjectsMap, KeyedUnarchiver, IArchivedInstance } from "../keyed-unarchiver";

export class NSUUIDCoder extends KeyedUnarchiver<Uuid> {
  static readonly $classname = 'NSUUID';

  constructor(readonly $objects: $ObjectsMap, readonly data: IArchivedInstance) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new NSUUIDCoder($objects, data);
  }

  decode(): Uuid {
    const uuidbytes = this.data['NS.uuidbytes'];
    if (!(uuidbytes instanceof ArrayBuffer)) {
      throw new Error('Invalid NSUUID instance');
    }
    if (uuidbytes.byteLength < 16) {
      throw new Error('Invalid NSUUID; too few bytes');
    }

    const value = deStruct([128], new DataView(uuidbytes))[0];

    return new Uuid(value);
  }
}
