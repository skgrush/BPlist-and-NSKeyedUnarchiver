import { Uid } from '@skgrush/bplist-and-nskeyedunarchiver/bplist';
import { IArchivedObject } from "./archive-types";

/**
 * The expected structure of a decoded bplist made by NSKeyedArchiver.
 */

export type IArchivedPList = {
  readonly $version: bigint;
  readonly $archiver: 'NSKeyedArchiver';
  readonly $top: {
    readonly root: Uid;
  };
  readonly $objects: IArchivedObject;
};
