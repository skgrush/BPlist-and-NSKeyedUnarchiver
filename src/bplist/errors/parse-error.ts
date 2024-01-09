import { IParseContext } from "../parse-context";

export class ParseError extends Error {
  readonly name = 'ParseError';

  constructor(message: string, readonly pc: IParseContext) {
    super(message);
  }
}
