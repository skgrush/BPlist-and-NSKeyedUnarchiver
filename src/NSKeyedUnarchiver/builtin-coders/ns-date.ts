// import { cfAbsoluteTimeEpochMilliseconds } from "@skgrush/bplist-and-nskeyedunarchiver/bplist";
import { cfAbsoluteTimeEpochMilliseconds } from '../../bplist';
import { KeyedUnarchiver } from "../keyed-unarchiver";
import { $ObjectsMap } from "../$objects-map";
import { IArchivedInstance } from '../types/archive-types';

export class NSDateCoder extends KeyedUnarchiver<Date> {
  static readonly $classname = 'NSDate';

  constructor(readonly $objects: $ObjectsMap, readonly data: IArchivedInstance) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new NSDateCoder($objects, data);
  }

  decode(): Date {
    const time = this.data['NS.time'];
    if (typeof time !== 'number') {
      throw new Error('Invalid NSDate instance');
    }

    return new Date(cfAbsoluteTimeEpochMilliseconds + time);
  }
}
