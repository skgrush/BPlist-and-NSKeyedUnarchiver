import { Uuid } from "../bplist/models/uuid";
import { KeyedUnarchiver } from './keyed-unarchiver';
import { NSDateCoder } from './builtin-coders/ns-date';
import { NSArrayCoder } from './builtin-coders/ns-array';
import { NSUUIDCoder } from './builtin-coders/ns-uuid';
import { Float3, Float4, Float4x4 } from './types/simd';
import { $ObjectsMap } from "./$objects-map";
import { IArchivedInstance } from "./types/archive-types";

type ScanFile = {
  readonly encodingVersion: bigint;
  readonly timestamp: Date;
  readonly name: string;
  readonly center: Float3;
  readonly extent: Float3;
  readonly meshAnchors: CSMeshSlice[];
  readonly startSnapshot: CSMeshSnapshot | null;
  readonly endSnapshot: CSMeshSnapshot | null;
  readonly stations: SurveyStation[];
  readonly lines: SurveyLine[];

  // readonly location: CSLocation | null;
}

type CSMeshSlice = {
  readonly identifier: Uuid;
  readonly transform: Float4x4;
  readonly vertices: CSMeshGeometrySource;
  readonly faces: CSMeshGeometryElement;
  readonly normals: CSMeshGeometrySource;
}

type CSMeshSnapshot = {
  readonly imageData: ArrayBuffer;
  readonly transform: Float4x4;
  readonly identifier: Uuid;
  readonly name: string | null;
}

type SurveyLine = {
  readonly startIdentifier: Uuid;
  readonly endIdentifier: Uuid;
}

type SurveyStation = {
  readonly name: string;
  readonly identifier: Uuid;
  readonly transform: Float4x4;
}

type CSMeshGeometrySource = {
  readonly semantic: string;

  readonly bytesPerComponent: bigint;
  readonly componentsPerVector: bigint;

  readonly data: ArrayBuffer;
  readonly count: bigint;
  readonly format: bigint;
  readonly offset: bigint;
  readonly stride: bigint;
}

type CSMeshGeometryElement = {
  readonly data: ArrayBuffer;
  readonly bytesPerIndex: bigint;
  readonly count: bigint;
  readonly indexCountPerPrimitive: bigint;
  readonly primitiveType: bigint;
}

class ScanFileCoder extends KeyedUnarchiver<ScanFile> {

  static readonly $classname = 'CavernSeer.ScanFile';

  constructor(
    readonly $objects: $ObjectsMap,
    readonly data: IArchivedInstance,
  ) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new ScanFileCoder($objects, data);
  }

  decode(): ScanFile {
    const version = this.containsValue('version')
      ? this.decodeInt32('version')
      : 1;

    if (version === 1) {
      throw new Error('Unfortunately cavernseerscan version 1 files are unsupported :(. Upgrade your file in CavernSeer to version 2 first.');
    }
    if (version > 2) {
      throw new Error(`Unknown cavernseerscan version ${version}`);
    }

    const timestamp = this.decodeObjectOf(NSDateCoder, 'timestamp', true);
    const name = this.decodeString('name', true);
    const center = CavernSeerCustomDecoders.decodeFloat3(this, 'center');
    const extent = CavernSeerCustomDecoders.decodeFloat3(this, 'extent');
    const meshAnchors = this.decodeObjectOf([NSArrayCoder, CSMeshSliceCoder], 'meshAnchors', true) as CSMeshSlice[];
    const startSnapshot = this.decodeSnapshot('startSnapshot');
    const endSnapshot = this.decodeSnapshot('endSnapshot');
    const stations = this.decodeObjectOf([NSArrayCoder, SurveyStationCoder], 'stations') as SurveyStation[] ?? [];
    const lines = this.decodeObjectOf([NSArrayCoder, SurveyLineCoder], 'lines') as SurveyLine[] ?? [];
    const location = null;

    return {
      encodingVersion: version,
      timestamp,
      name,
      center,
      extent,
      meshAnchors,
      startSnapshot,
      endSnapshot,
      stations,
      lines,
      // location,
    }
  }

  private decodeSnapshot(key: string): CSMeshSnapshot | null {
    if (!this.containsValue(key)) {
      return null;
    }

    // assumes version === 2
    return this.decodeObjectOf(CSMeshSnapshotCoder, key);
  }
}

class CSMeshSliceCoder extends KeyedUnarchiver<CSMeshSlice> {

  static readonly $classname = 'CavernSeer.CSMeshSlice';

  constructor(
    readonly $objects: $ObjectsMap,
    readonly data: IArchivedInstance,
  ) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new CSMeshSliceCoder($objects, data);
  }

  decode(): CSMeshSlice {
    return {
      identifier: this.decodeObjectOf(NSUUIDCoder, 'identifier', true),
      transform: CavernSeerCustomDecoders.decodeFloat4x4(this, 'transform'),
      vertices: this.decodeObjectOf(CSMeshGeometrySourceCoder, 'vertices', true),
      faces: this.decodeObjectOf(CSMeshGeometryElementCoder, 'faces', true),
      normals: this.decodeObjectOf(CSMeshGeometrySourceCoder, 'normals', true),
    };
  }
}

class CSMeshSnapshotCoder extends KeyedUnarchiver<CSMeshSnapshot> {

  static readonly $classname = 'CavernSeer.CSMeshSnapshot';

  constructor(
    readonly $objects: $ObjectsMap,
    readonly data: IArchivedInstance,
  ) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new CSMeshSnapshotCoder($objects, data);
  }

  decode(): CSMeshSnapshot {
    return {
      imageData: this.decodeBytes('imageData', true),
      transform: CavernSeerCustomDecoders.decodeFloat4x4(this, 'transform'),
      identifier: this.decodeObjectOf(NSUUIDCoder, 'identifier', true),
      name: this.decodeObject('name'),
    };
  }
}

class SurveyLineCoder extends KeyedUnarchiver<SurveyLine> {

  static readonly $classname = 'CavernSeer.SurveyLine';

  constructor(
    readonly $objects: $ObjectsMap,
    readonly data: IArchivedInstance,
  ) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new SurveyLineCoder($objects, data);
  }

  decode(): SurveyLine {
    return {
      startIdentifier: this.decodeObjectOf(NSUUIDCoder, 'startId', true),
      endIdentifier: this.decodeObjectOf(NSUUIDCoder, 'endId', true),
    }
  }
}
class SurveyStationCoder extends KeyedUnarchiver<SurveyStation> {

  static readonly $classname = 'CavernSeer.SurveyStation';

  constructor(
    readonly $objects: $ObjectsMap,
    readonly data: IArchivedInstance,
  ) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new SurveyLineCoder($objects, data);
  }

  decode(): SurveyStation {
    return {
      identifier: this.decodeObjectOf(NSUUIDCoder, 'identifier', true),
      transform: CavernSeerCustomDecoders.decodeFloat4x4(this, 'transform'),
      name: this.decodeObject('name'),
    }
  }
}
class CSMeshGeometrySourceCoder extends KeyedUnarchiver<CSMeshGeometrySource> {

  static readonly $classname = 'CavernSeer.CSMeshGeometrySource';

  constructor(
    readonly $objects: $ObjectsMap,
    readonly data: IArchivedInstance,
  ) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new CSMeshGeometrySourceCoder($objects, data);
  }

  decode(): CSMeshGeometrySource {
    return {
      bytesPerComponent: this.decodeInt32('bytesPerComponent'),
      componentsPerVector: this.decodeInt32('componentsPerVector'),
      count: this.decodeInt64('count'),
      offset: this.decodeInt64('offset'),
      stride: this.decodeInt64('stride'),
      format: this.decodeInt64('format'),
      data: this.decodeBytes('data', true),
      semantic: this.decodeObject('semantic'),
    };
  }
}
class CSMeshGeometryElementCoder extends KeyedUnarchiver<CSMeshGeometryElement> {

  static readonly $classname = 'CavernSeer.CSMeshGeometryElement';

  constructor(
    readonly $objects: $ObjectsMap,
    readonly data: IArchivedInstance,
  ) {
    super();
  }

  static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
    return new CSMeshGeometryElementCoder($objects, data);
  }

  decode(): CSMeshGeometryElement {
    return {
      data: this.decodeBytes('data', true),
      primitiveType: this.decodeInt32('primitiveType'),
      bytesPerIndex: this.decodeInt32('bytesPerIndex'),
      count: this.decodeInt32('count'),
      indexCountPerPrimitive: this.decodeInt32('indexCountPerPrimitive'),
    };
  }
}

abstract class CavernSeerCustomDecoders {
  static decodeFloat3(coder: KeyedUnarchiver<any>, prefix: string) {
    const x = coder.decodeFloat(`${prefix}_x`);
    const y = coder.decodeFloat(`${prefix}_y`);
    const z = coder.decodeFloat(`${prefix}_z`);

    return [x, y, z] as const;
  }

  static decodeFloat4(coder: KeyedUnarchiver<any>, prefix: string): Float4 {
    const x = coder.decodeFloat(`${prefix}_x`);
    const y = coder.decodeFloat(`${prefix}_y`);
    const z = coder.decodeFloat(`${prefix}_z`);
    const w = coder.decodeFloat(`${prefix}_w`);
    return [x, y, z, w];
  }

  static decodeFloat4x4(coder: KeyedUnarchiver<any>, prefix: string): Float4x4 {
    const col0 = CavernSeerCustomDecoders.decodeFloat4(coder, `${prefix}_0`);
    const col1 = CavernSeerCustomDecoders.decodeFloat4(coder, `${prefix}_1`);
    const col2 = CavernSeerCustomDecoders.decodeFloat4(coder, `${prefix}_2`);
    const col3 = CavernSeerCustomDecoders.decodeFloat4(coder, `${prefix}_3`);

    return [col0, col1, col2, col3];
  }
}


import { main as readerMain } from '../bplist/reader.node.spec';
import { IArchivedPList } from "./types/archived-plist";

async function main() {
  const result = readerMain();

  if (!result) {
    throw new Error('missing result');
  }

  const scanFile = ScanFileCoder.unarchiveObject(ScanFileCoder, result as IArchivedPList);

  debugger;
}


if (require.main === module) {
  main();
}
