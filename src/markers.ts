import { assert } from "./assert";
import { IParseContext } from "./parse-context";

export enum Marker {
  null = 0b0000_0000, // 0x00
  false = 0b0000_1000, // 0x08
  true = 0b0000_1001, // 0x09
  fill = 0b0000_1111, // 0x0F
  /** lower nibble is exponent of byte-size of the int */
  int = 0b0001_0000, // 0x10
  /** lower nibble is exponent of byte-size of the real */
  real = 0b0010_0000, // 0x20
  date = 0b0011_0000, // 0x30
  /** lower nibble is byte-size or 1111 for trailing int-based size, then bytes */
  data = 0b0100_0000, // 0x40
  /** lower nibble is byte-size or 1111 for trailing int-based size, then bytes */
  ascii = 0b0101_0000, // 0x50
  /** lower nibble is "char count" (TODO:) or 1111 for trailing int-based size, then 2-byte chars??? */
  unicode = 0b0110_0000, // 0x60
  /** lower nibble is byte-size minus 1 */
  uid = 0b1000_0000, // 0x80
  /** lower nibble is count or 1111 for trailing int-based count, then objrefs */
  array = 0b1010_0000, // 0xA0
  /** lower nibble is count or 1111 for trailing int-based count, then objrefs */
  set = 0b1100_0000, // 0xC0
  /** lower nibble is count or 1111 for trailing int-based count, then keyrefs and objrefs */
  dict = 0b1101_0000, // 0xD0
}

export const v00Markers: ReadonlySet<Marker> = new Set([
  Marker.null,
  Marker.false,
  Marker.true,
  Marker.fill,
  Marker.int,
  Marker.real,
  Marker.date,
  Marker.data,
  Marker.ascii,
  Marker.unicode,
  Marker.uid,
  Marker.array,
  Marker.set,
  Marker.dict,
]);

export const markerPrimitives: ReadonlyMap<Marker, null | false | true | undefined> = new Map([
  [Marker.null, null],
  [Marker.false, false],
  [Marker.true, true],
  [Marker.fill, undefined],
]);

export type MarkerByteParts = {
  readonly marker: Marker;
  readonly lowerNibble: number;
}

export function byteToMarker(byte: number, pc: IParseContext): MarkerByteParts | null {
  assert(((byte | 0) & 0xFF) === byte, `byte arg is not an integral byte: ${byte}`);

  const upperNibbleMasked = byte & 0xF0;
  const lowerNibbleMasked = byte & 0x0F;

  let marker: Marker;
  if (upperNibbleMasked === 0) {
    marker = byte;
  } else {
    marker = upperNibbleMasked;
  }

  if (Marker[marker] === undefined) {
    console.warn('byte upper nibble is unknown', { byte, upperNibbleMasked, pc });
    return null;
  }

  // `byte` is a complex type marker with some dynamic sizing
  return {
    marker,
    lowerNibble: lowerNibbleMasked,
  }
}
