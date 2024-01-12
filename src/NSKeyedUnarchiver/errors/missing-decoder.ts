
export class MissingDecoder extends Error {
  constructor(readonly $classname: string, readonly parent$classname: string) {
    super(`Could not find $classname=${$classname} in Coder for ${parent$classname}`);
  }
}
