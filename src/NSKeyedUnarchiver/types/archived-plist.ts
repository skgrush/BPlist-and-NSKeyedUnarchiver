import { Uid } from "../bplist";
import { IArchivedObject } from "./types/archive-types";

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
