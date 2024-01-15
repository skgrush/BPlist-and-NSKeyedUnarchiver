import { Uid } from "@skgrush/bplist-and-nskeyedunarchiver/bplist";
import { $ObjectsMap } from "./$objects-map";
import { DecodeMismatch } from "./errors/decode-mismatch";
import { MissingDecoder } from "./errors/missing-decoder";
import { IArchivedClass, IArchivedInstance } from "./types/archive-types";
import { IArchivedPList } from "./types/archived-plist";

// $class:Uid means a link to a class name

export interface CoderType<T> extends Function {
  new(...args: any[]): KeyedUnarchiver<T>;

  readonly $classname: string;
  initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance): KeyedUnarchiver<T>;
}

type TOrMaybeThrows<T, MaybeThrows extends boolean | undefined> = MaybeThrows extends true ? T : T | null;

export abstract class KeyedUnarchiver<TClass> {

  abstract readonly $objects: $ObjectsMap;
  abstract readonly data: IArchivedInstance;

  private readonly _classNameCoders = new Map<string, CoderType<any>>();

  abstract decode(): TClass;

  setClass(coderClass: CoderType<any>, forClassName = coderClass.$classname) {
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

  static unarchiveObject<T>(ofClass: CoderType<T>, from: IArchivedPList) {
    if (from.$archiver !== 'NSKeyedArchiver') {
      throw new Error('$archiver is not NSKeyedArchiver');
    }
    if (from.$version !== 100000n) {
      console.warn(`Unexpected NSKeyedArchiver version; expected 100000 but got ${from.$version}`);
    }

    if (!Array.isArray(from.$objects)) {
      throw new Error('Invalid NSKeyedArchiver object: from.$objects must be an array of objects');
    }
    const $objectsMap = new $ObjectsMap(from.$objects);

    const top = from.$top?.root;
    if (!(top instanceof Uid)) {
      throw new Error('Missing $top.root from archived plist');
    }
    const topInstance = $objectsMap.getByUid(top);
    if (topInstance === null) {
      throw new Error('$top.root does not match index in $objects');
    }
    if (!(typeof topInstance === 'object' && '$class' in topInstance && topInstance.$class instanceof Uid)) {
      throw new Error('$top.root does not point to an instance with a $class property');
    }

    const coder = ofClass.initForReadingDataFrom($objectsMap, topInstance);

    return coder.decode();
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

  decodeBytes<TThrows extends boolean | undefined>(forKey: string, throwsIfNull?: TThrows): TOrMaybeThrows<ArrayBuffer, TThrows> {
    const value = this.getRawValueFromDataOrUid(forKey);
    if ((value === undefined || value === null) && throwsIfNull) {
      throw new Error(`Value for key ${forKey} is null or omitted`);
    }
    if (value instanceof ArrayBuffer) {
      return value;
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

  decodeString<TThrows extends boolean | undefined>(forKey: string, throwsIfNull?: TThrows): TOrMaybeThrows<string, TThrows> {
    const value = this.decodeObject(forKey, throwsIfNull);
    if (typeof value !== 'string') {
      throw new Error(`Value for key ${forKey} is not a string: ${value}`);
    }
    return value;
  }

  decodeObject<TThrows extends boolean | undefined>(forKey: string, throwsIfNull?: TThrows): any {
    const uid = this.data[forKey];
    if (uid !== undefined && !(uid instanceof Uid)) {
      throw new DecodeMismatch(forKey, 'uid (for object)', uid);
    }
    if (uid === undefined) {
      if (throwsIfNull) {
        throw new Error(`Value for key ${forKey} is null`);
      }
      return null;
    }

    return this._decodeObjectWeThinkIsInTheClassMap(uid, forKey);
  }

  decodeObjectOf<Ts extends readonly any[], TThrows extends boolean | undefined = undefined>(of: { readonly [k in keyof Ts]: CoderType<Ts[k]> }, forKey: string, throwsIfNull?: TThrows): TOrMaybeThrows<Ts[number], TThrows>;
  decodeObjectOf<T, TThrows extends boolean | undefined = undefined>(of: CoderType<T>, forKey: string, throwsIfNull?: TThrows): TOrMaybeThrows<T, TThrows>;
  decodeObjectOf(of: CoderType<any> | readonly CoderType<any>[], forKey: string, throwsIfNull?: boolean) {

    const uid = this.data[forKey];
    if (uid !== undefined && !(uid instanceof Uid)) {
      throw new DecodeMismatch(forKey, 'uid (for object)', uid);
    }
    if (uid === undefined) {
      if (throwsIfNull) {
        throw new Error(`Key ${forKey} is null`);
      }
      return null;
    }

    const { instance, isSpecial } = this._getInstanceByUid(uid, forKey);

    if (instance === null) {
      if (throwsIfNull) {
        throw new Error(`Key ${forKey} is null`);
      }
      return null;
    }
    if (isSpecial) {
      throw new DecodeMismatch(forKey, 'decode-able type', `'special type ${forKey} which should just use decodeObject()'`);
    }

    const instanceClassResult = this._getClassFromUidOrThrow(uid, forKey);
    if (!instanceClassResult.isClass) {
      throw new Error(`Found non-class while searching for class for key=${forKey} at uid=${instance.$class.value}`);
    }
    const coderClassName = instanceClassResult.cls.$classname;

    const types: CoderType<any>[] = (Array.isArray(of) ? of : [of]);

    const coderClass = types.find(typ => typ.$classname === coderClassName);
    if (!coderClass) {
      throw new Error(`No classes passed in (${types.map(t => t.$classname)}) matched $classname=${coderClassName}`);
    }

    return this._decodeObjectAtUidOfClass(uid, coderClass, types.filter(t => t !== coderClass));
  }

  protected _decodeObjectAtUidOfClass<T>(uid: Uid, coderClass: CoderType<T>, withAdditionalClasses: readonly CoderType<any>[] = []) {
    const { instance, isSpecial } = this._getInstanceByUid(uid);
    if (isSpecial) {
      return instance;
    }

    const coder = coderClass.initForReadingDataFrom(this.$objects, instance);

    for (const otherCoder of withAdditionalClasses) {
      if (otherCoder !== coderClass) {
        coder.setClass(otherCoder);
      }
    }

    return coder.decode();
  }

  protected _decodeObjectWeThinkIsInTheClassMap(uid: Uid, forKeyForLogging: string) {
    const result = this._getClassFromUidOrThrow(uid, forKeyForLogging);
    if (!result.isClass) {
      return result.instance;
    }
    const cls = result.cls;

    const coderType = this._classNameCoders.get(cls.$classname);
    // TODO: should we use the `cls.$classes`
    if (!coderType) {
      throw new MissingDecoder(cls.$classname, (this.constructor as CoderType<TClass>).$classname);
    }

    return this._decodeObjectAtUidOfClass(uid, coderType);
  }

  protected _getClassFromUidOrThrow(uidOfInstance: Uid, forKeyForLogging?: string): IInstanceDescriptor | { isClass: true, cls: IArchivedClass } {
    const result = this._getInstanceByUid(uidOfInstance, forKeyForLogging);
    if (result.isSpecial) {
      return result;
    }
    const { instance } = result;

    const clsUid = instance.$class;
    const cls = this.$objects.getByUid(clsUid);
    if (cls === null || cls instanceof ArrayBuffer || !(typeof cls === 'object' && '$classname' in cls && cls['$classname'] !== undefined)) {
      throw new DecodeMismatch(`Class-${clsUid}`, 'class-object', cls);
    }

    return { isClass: true, cls };
  }

  private _getInstanceByUid(uid: Uid, forKeyForLogging?: string): IInstanceDescriptor {
    const instance = this.$objects.getByUid(uid);

    // special cases first
    if (typeof instance === 'string' || instance instanceof ArrayBuffer || instance === null) {
      return { instance, isSpecial: true as const };
    }

    if (!('$class' in instance)) {
      console.error('Context:', { instance });
      throw new DecodeMismatch(forKeyForLogging ?? `Uid<${uid}>`, 'object with $class', instance);
    }
    return { instance, isSpecial: false as const };
  }
}

type IInstanceDescriptor =
  | { isSpecial: true, instance: string | ArrayBuffer | null, isClass?: never }
  | { isSpecial: false, instance: IArchivedInstance, isClass?: never };
