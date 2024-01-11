import { Uid, ObjectTableOutput } from "@skgrush/bplist-and-nskeyedunarchiver/bplist";

// $class:Uid means a link to a class name

export interface CoderType<T> extends Function {
  new(...args: any[]): Coder<T>;

  initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance): Coder<T>;
}

type ClassName = string;


export type IArchivedInstance = { readonly $class: Uid, $classname: never, readonly [key: string]: ObjectTableOutput | undefined }
export type IArchivedClass = { readonly $classname: ClassName, $classes: readonly ClassName[] }
export type IArchivedObject =
  | string
  | ArrayBuffer
  | IArchivedInstance
  | IArchivedClass
  ;

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

export class DecodeMismatch extends Error {
  constructor(readonly key: string, readonly expectedType: string, readonly actual: any) {
    super(`For key ${key}: expected ${expectedType} but found ${actual}`);
  }
}
export class MissingDecoder extends Error {
  constructor(readonly $classname: string, readonly parent$classname: string) {
    super(`Could not find $classname=${$classname} in Coder for ${parent$classname}`);
  }
}

/**
 * The expected structure of a decoded bplist made by NSKeyedArchiver.
 */
export type IArchivedPList = {
  readonly $version: bigint;
  readonly $archiver: 'NSKeyedArchiver';
  readonly $top: {
    readonly root: Uid;
  }
  readonly $objects2: IArchivedObject;
}

export abstract class Coder<TClass> {

  abstract readonly $classname: string;
  abstract readonly $objects: $ObjectsMap;
  abstract readonly data: IArchivedInstance;

  private readonly _classNameCoders = new Map<string, CoderType<any>>();

  constructor() { }

  abstract decode(): TClass;

  setClass(coderClass: CoderType<any>, forClassName: string) {
    const existing = this._classNameCoders.get(forClassName);
    if (existing && existing !== coderClass) {
      throw new Error(`Coder for class name ${forClassName} already exists`);
    }
    this._classNameCoders.set(forClassName, coderClass);
  }
  getClass<T>(forClassName: string): CoderType<T> | undefined {
    return this._classNameCoders.get(forClassName);
  }

  private getRawValueFromDataOrUid(forKey: string) {
    const value = this.data[forKey];
    if (value instanceof Uid) {
      return this.$objects.getByUid(value);
    }
    return value;
  }


  // de/coding

  containsValue(forKey: string): boolean {
    return forKey[0] !== '$' && this.data[forKey] !== undefined;
  }

  decodeBool(forKey: string): boolean {
    const value = this.data[forKey];
    if (value === undefined || typeof value === 'boolean') {
      return value ?? true;
    }
    throw new DecodeMismatch(forKey, 'boolean', typeof value);
  }

  decodeBytes(forKey: string): ArrayBuffer | null {
    const value = this.getRawValueFromDataOrUid(forKey);
    if (value === undefined || value === null || value instanceof ArrayBuffer) {
      return value ?? null;
    }
    throw new DecodeMismatch(forKey, 'Blob', value);
  }

  decodeDouble(forKey: string): number {
    const value = this.data[forKey];
    if (value === undefined || typeof value === 'number') {
      return value ?? 0;
    }
    throw new DecodeMismatch(forKey, 'number', value);
  }

  decodeFloat(forKey: string): number {
    return this.decodeDouble(forKey);
  }

  decodeInt32(forKey: string): bigint {
    const value = this.data[forKey];
    if (value === undefined || typeof value === 'bigint') {
      return value ?? 0n;
    }
    throw new DecodeMismatch(forKey, 'bigint', value);
  }

  decodeInt64(forKey: string): bigint {
    return this.decodeInt32(forKey);
  }

  decodeObject(forKey: string): any {
    const uid = this.data[forKey];
    if (uid !== undefined && !(uid instanceof Uid)) {
      throw new DecodeMismatch(forKey, 'uid (for object)', uid);
    }
    if (uid === undefined) {
      return null;
    }

    return this._decodeKnownObject(uid, forKey);
  }

  decodeObjectOf<TCoder extends CoderType<unknown>>(of: TCoder, forKey: string) {
    if (Array.isArray(of)) {
      throw new Error('NotYetImplemented');
    }

    const uid = this.data[forKey];
    if (uid !== undefined && !(uid instanceof Uid)) {
      throw new DecodeMismatch(forKey, 'uid (for object)', uid);
    }
    if (uid === undefined) {
      return null;
    }

    const { instance, isSpecial } = this._getInstanceByUid(uid, forKey);

    if (instance === null) {
      return null;
    }
    if (isSpecial) {
      throw new DecodeMismatch(forKey, 'decode-able type', `'special type ${forKey} which should just use decodeObject()'`);
    }

    const coder = of.initForReadingDataFrom(this.$objects, instance);

    return coder.decode() as (TCoder extends CoderType<infer R> ? R : never);
  }

  protected _decodeKnownObject(uid: Uid, forKey: string) {
    const { instance, isSpecial } = this._getInstanceByUid(uid, forKey);
    if (isSpecial) {
      return instance;
    }

    const clsUid = instance.$class;
    const cls = this.$objects.getByUid(clsUid);
    if (cls === null || !(typeof cls === 'object' && '$classname' in cls)) {
      throw new DecodeMismatch(`Class-Uid<${clsUid}>`, 'class-object', cls);
    }

    const coderType = this._classNameCoders.get(cls.$classname);
    // TODO: should we use the `cls.$classes`
    if (!coderType) {
      throw new MissingDecoder(cls.$classname, this.$classname);
    }

    return this.decodeObjectOf(coderType, forKey);
  }

  private _getInstanceByUid(uid: Uid, forKey: string) {
    const instance = this.$objects.getByUid(uid);

    // special cases first
    if (typeof instance === 'string' || instance instanceof ArrayBuffer || instance === null) {
      return { instance, isSpecial: true as const };
    }

    if (!('$class' in instance)) {
      throw new DecodeMismatch(forKey ?? `Uid<${uid}>`, 'object with $class', instance);
    }
    return { instance, isSpecial: false as const };
  }
}


export class KeyedUnarchiver {

  static unarchiveObject(ofClass: any, from: ArrayBuffer) {

  }
}



// class A extends Coder<number> {

// }

// class B extends Coder<string> {
//   static initForReadingDataFrom(): B { }
// }


// const a = new A();

// const resultOfB = a.decodeObjectOf(B, 'blah');
