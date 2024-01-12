// import { Uid } from "@skgrush/bplist-and-nskeyedunarchiver/bplist";
import { Uid } from '../../bplist';
import { $ObjectsMap, KeyedUnarchiver, IArchivedInstance } from "../keyed-unarchiver";


export class NSArrayCoder extends KeyedUnarchiver<Array<unknown>> {
  static readonly $classname = 'NSArray';

  constructor(readonly $objects: $ObjectsMap, readonly data: IArchivedInstance) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new NSArrayCoder($objects, data);
  }

  decode(): unknown[] {
    const objects = this.data['NS.objects'];
    if (!Array.isArray(objects)) {
      throw new Error('Invalid NSArray instance');
    }

    return objects.map((uid: Uid, idx) => {
      if (!(uid instanceof Uid)) {
        console.warn('NSArray value at [', idx, '] is not a Uid; returning it directly:', uid);
        return uid;
      }

      return this._decodeObjectWeThinkIsInTheClassMap(uid, `NSArray[${idx}]`);
    });
  }

}
