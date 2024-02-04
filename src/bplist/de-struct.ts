
export type AcceptedBitLength = 8 | -8 | 16 | -16 | 32 | -32 | 64 | -64 | 128 | -128;
type BitLengthArray = readonly (AcceptedBitLength)[];

type BitLengthToType<T extends AcceptedBitLength> =
  T extends 64 | -64 | 128 | -128 ? bigint : number;

type DeStructResult<T extends BitLengthArray> = {
  [k in keyof T]: BitLengthToType<T[k]>;
}

export type DeStructWithReader<T extends number | bigint = number | bigint> = ((v: DataView, offset: number) => ({ value: T, bytesRead: number }));
type ReaderArray = readonly DeStructWithReader[];
type DeStructWithResult<Fns extends ReaderArray> = {
  [fn in keyof Fns]: ReturnType<Fns[fn]>['value']
}

/**
 *
 * @throws RangeError if reading out of bounds
 */
export function deStruct<const Ts extends BitLengthArray>(
  input: Ts,
  view: DataView,
) {
  const readers = input.map(inp => readerMap[inp]);

  return deStructWith(readers, view) as DeStructResult<Ts>;
}

export function deStructWith<const Fns extends ReaderArray>(
  fns: Fns,
  view: DataView,
) {
  const result = [...deStructWithIter(fns, view)] as DeStructWithResult<Fns>;

  return result;
}

export function* deStructWithIter<const Fns extends Iterable<DeStructWithReader>>(
  fns: Fns,
  view: DataView,
) {
  let currentByteOffset = 0;

  type DeStructorType = Fns extends Iterable<infer R> ? R : never;
  type R = ReturnType<DeStructorType>['value'];

  for (const fn of fns) {
    const { value, bytesRead } = fn(view, currentByteOffset);
    yield value as R;
    currentByteOffset += bytesRead;
  }
}

export function getDeStructReaderBySize<T extends AcceptedBitLength>(bitLength: T) {
  return readerMap[bitLength];
}

const readerMap = {
  [8]: (view: DataView, byteOffset: number) => ({ value: view.getUint8(byteOffset), bytesRead: 1 }),
  [-8]: (view: DataView, byteOffset: number) => ({ value: view.getInt8(byteOffset), bytesRead: 1 }),
  [16]: (view: DataView, byteOffset: number) => ({ value: view.getUint16(byteOffset), bytesRead: 2 }),
  [-16]: (view: DataView, byteOffset: number) => ({ value: view.getInt16(byteOffset), bytesRead: 2 }),
  [32]: (view: DataView, byteOffset: number) => ({ value: view.getUint32(byteOffset), bytesRead: 4 }),
  [-32]: (view: DataView, byteOffset: number) => ({ value: view.getUint32(byteOffset), bytesRead: 4 }),
  [-64]: (view: DataView, byteOffset: number) => ({ value: view.getBigInt64(byteOffset), bytesRead: 8 }),
  [64]: (view: DataView, byteOffset: number) => ({ value: view.getBigUint64(byteOffset), bytesRead: 8 }),
  [128]: (view: DataView, byteOffset: number) => {
    const high = view.getBigUint64(byteOffset);
    const low = view.getBigUint64(byteOffset + 8);
    return {
      value: (high << 8n) + low,
      bytesRead: 16,
    };
  },
  [-128]: (view: DataView, byteOffset: number) => {
    console.warn('Destructuring signed int128 is currently unsupported');
    const high = view.getBigInt64(byteOffset);
    const low = view.getBigUint64(byteOffset + 8);
    return {
      value: (high << 8n) - low,
      bytesRead: 16,
    }
  }
} as const;
