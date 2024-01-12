
export class Uid {
  constructor(readonly value: bigint) { }
  inspect() {
    this.toString();
  }
  toString() {
    return `Uid<${this.value}>`;
  }
}
