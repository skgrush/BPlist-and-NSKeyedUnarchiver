# BPlist-and-NSKeyedUnarchiver

> Tool for deserializing binary plist files and NSKeyedUnarchiver-coded files.

## Origin and licensing

Based on the implementation in Apple's open-sourced [CFBinaryPList.c](https://opensource.apple.com/source/CF/CF-550/CFBinaryPList.c), licensed under APSL v2.0.
As a result, this code is likely a derivative work of said code,
therefore this code and all changes to it will be made public,
along with a copy of the
APSL v2 in [OriginalCode.APSL.LICENSE](./OriginalCode.APSL.LICENSE).

**However**, as this code does not use any of the original C code, original
or modified, I feel mildly comfortable in licensing this project as MIT, as
long as the source-publishing criteria are met.


## Usage

### BPlist

These examples show reading a file (in Node and in the Browser)
and parsing the top-level BPlist object from it.

#### Node

```ts
const { readFile } = require('node:fs/promises'); 
const { Reader } = require('@skgrush/bplist-and-nskeyedunarchiver/bplist/reader');

async function readBPlistFromFilePath(filePath: string) {
    const nodeBuffer = await readFile(filePath);
    const arrayBuffer = nodeBuffer.buffer.slice(
        nodeBuffer.byteoffset,
        nodeBuffer.byteOffset + nodeBuffer.byteLength,
    );

    const reader = new Reader(arrayBuffer);

    const object = reader.buildTopLevelObject();
}
```

#### Browser

```ts
import { Reader } from '@skgrush/bplist-and-nskeyedunarchiver/bplist/reader';

async function readBPlistFromBlob(blob: Blob) {
    const arrayBuffer = await blob.arrayBuffer();

    const reader = new Reader(arrayBuffer);

    return reader.buildTopLevelObject();
}
```

### NSKeyedUnarchiver

This example provides examples of how to unarchive a custom class containing some native NS types,
including arrays of other custom class.

```ts
import { Reader } from '@skgrush/bplist-and-nskeyedunarchiver/bplist/reader';
import { $ObjectsMap, IArchivedInstance, KeyedUnarchiver, NSArrayCoder, NSDateCoder, NSUUIDCoder } from '@skgrush/bplist-and-nskeyedunarchiver/NSKeyedUnarchiver';


async function readMyClassFromBlob(blob: Blob) {
    // see BPlist example above
    const bplistObject = await readBPlistFromBlob(blob);
    
    // top level objects can be any type, so you may want to filter out any of the possible types
    if (!bplistObject || typeof bplistObject !== 'object' || !('$archiver' in bplistObject)) {
        throw new Error('Invalid BPList object file');
    }
    
    return MyDecoder.unarchiveObject(MyDecoder, bplistObject);
}


class MyDecoder extends KeyedUnarchiver<MyClass> {
    static readonly $classname = 'MyNamespace.MyClassname';

    constructor(
        readonly $objects: $ObjectsMap,
        readonly data: IArchivedInstance,
    ) {
        super();
    }

    static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
        return new MyDecoder($objects, data);
    }
    
    decode(): MyClass {

        // decode the properties of your class
        const myTimestamp = this.decodeObjectOf(NSDateCoder, 'myTimestamp', true);
        const myName = this.decodeString('myName', true);
        const arry = this.decodeObjectOf([NSArrayCoder, SomeOtherDecoder], 'arrayOfSomething', true) as SomeOtherClass[];
        
        return new MyClass(myTimestamp, myName, arry);
    }
}

class SomeOtherDecoder extends KeyedUnarchiver<SomeOtherClass> {
    static readonly $classname = 'MyNamespace.SomeOtherClass';

    constructor(
        readonly $objects: $ObjectsMap,
        readonly data: IArchivedInstance,
    ) {
        super();
    }

    static initForReadingDataFrom($objects: $ObjectsMap, data: IArchivedInstance) {
        return new SomeOtherDecoder($objects, data);
    }

    decode(): SomeOtherClass {
        const myUuid = this.decodeObjectOf(NSUuidCoder, 'myUuid', true);
        const myFloat = this.decodeFloat('myFloat');
        
        return new SomeOtherClass(myUuid);
    }
    
}
```