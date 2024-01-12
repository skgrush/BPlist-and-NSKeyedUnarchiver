
import { Reader } from './reader';

import { readFileSync, existsSync } from 'node:fs';

if (require.main === module) {
  main();
}

export function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error('no arg path');
    process.exit(1);
  }
  if (!existsSync(arg)) {
    console.error('does not exist');
    process.exit(2);
  }

  const nodeBuf = readFileSync(arg);
  const arrayBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength)

  const reader = new Reader(arrayBuffer);

  const result = reader.buildTopLevelObject();

  debugger;

  console.info('================ RESULT ================');
  console.info(result);

  return result;
}
