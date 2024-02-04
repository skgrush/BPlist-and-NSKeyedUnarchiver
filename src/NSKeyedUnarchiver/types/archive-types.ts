import { Uid, ObjectTableOutput } from "@skgrush/bplist-and-nskeyedunarchiver/bplist";

export type IArchivedInstance = { readonly $class: Uid, $classname?: never, readonly [key: string]: ObjectTableOutput | undefined }
export type IArchivedClass = { readonly $classname: string, $classes: readonly string[] }
export type IArchivedObject =
  | string
  | ArrayBuffer
  | IArchivedInstance
  | IArchivedClass
  ;
