const zlib = require("zlib");
//const zstd = require('zstd');
//const zstd = require('@skhaz/zstd');

//Number of transactions spending inputs that are of certain age
const arr = [
    696842,
    1128683,
    522179,
    259620,
    129380,
    51816,
    51666,
    70745
];

//Input age buckets (denoted in # of blocks)
const blocks = [
    6,
    144,
    144*7,
    144*30,
    144*90,
    144*180,
    144*360
];

//Total transaction count in array
const total = 2910931;

//Create an array of percentage for transaction ages
const pctArr = arr.map(e => e/total);

console.log(pctArr);

const txsPerBlock = 1024*1024;
const openedSealsPerBlock = 3*txsPerBlock;
const blockMultiplier = (16*1024*1024); //Must be strictly larger than openedSealsPerBlock

const currBlock = 5476272;

//Create spend seals that have the very same spending habit as utxos on bitcoin
let upperLimit = currBlock;
const sealArr = [];
for(let i=0;i<pctArr.length;i++) {
    const numTxs = Math.floor(pctArr[i]*txsPerBlock);
    let lowerLimit = blocks[i]==null ? 0 : upperLimit-blocks[i];

    const sealSet = new Set();
    for(let e=0;e<numTxs;e++) {
        const dBlock = Math.floor((upperLimit-lowerLimit)*Math.random());
        const block = upperLimit-dBlock;
        const sealNum = Math.floor(Math.random()*openedSealsPerBlock);
        let sealId = (block*blockMultiplier) + sealNum;
        if(sealSet.has(sealId)) {
            while(sealSet.has(sealId)) {
                const sealNum = Math.floor(Math.random()*openedSealsPerBlock);
                sealId = (block*blockMultiplier) + sealNum;
            }
        }
        sealSet.add(sealId);
    }

    sealSet.forEach(e => sealArr.push(e));

    upperLimit = lowerLimit;
}

sealArr.sort((a,b) => a-b);

console.log(sealArr);

const blockSealArr = {};

const sealObjArr = sealArr.map(e => {
    const block = Math.floor(e/blockMultiplier);
    const sealNum = e-(block*blockMultiplier);
    return {
        block,
        sealNum
    };
});

sealObjArr.forEach(e => {
    if(blockSealArr[e.block]==null) blockSealArr[e.block] = [];
    blockSealArr[e.block].push(e.sealNum);
});

const blockNums = Object.keys(blockSealArr).map(e => parseInt(e));

/*
0-252: 1 byte
253: 2 bytes
254: 3 bytes
255: 4 bytes
 */
function deltaCompressionBytes(sortedArray) {
    let lastElement = 0;
    let totalBytes = 0;
    for(let element of sortedArray) {
        const delta = element-lastElement;
        if(delta<=252) {
            totalBytes += 1;
        } else if(delta<256*256) {
            totalBytes += 3;
        } else if(delta<256*256*256) {
            totalBytes += 4;
        } else if(delta<256*256*256*256) {
            totalBytes += 5;
        }
        lastElement = element;
    }
    return totalBytes;
}

/*
Binary prefix:
00 - 6 bits
01 - 14 bits
10 - 22 bits
11 - 30 bits
 */
function deltaCompressionV2Bytes(sortedArray) {
    let lastElement = 0;
    let totalBytes = 0;
    for(let element of sortedArray) {
        const delta = element-lastElement;
        if(delta<64) {
            totalBytes += 1;
        } else if(delta<64*256) {
            totalBytes += 2;
        } else if(delta<64*256*256) {
            totalBytes += 3;
        } else if(delta<64*256*256*256) {
            totalBytes += 4;
        }
        lastElement = element;
    }
    return totalBytes;
}


/*
Binary prefixes:
7 bits - 8 bits
14 bits - 16 bits
21 bits - 24 bits
29 bits - 32 bits
 */
function deltaCompressionV3Bytes(sortedArray) {
    let lastElement = 0;
    let totalBytes = 0;
    for(let element of sortedArray) {
        const delta = element-lastElement;
        if(delta<128) {
            totalBytes += 1;
        } else if(delta<128*128) {
            totalBytes += 2;
        } else if(delta<128*128*128) {
            totalBytes += 3;
        } else if(delta<256*128*128*128) {
            totalBytes += 4;
        }
        lastElement = element;
    }
    return totalBytes;
}

function numToBuffer(delta) {
    if(delta<128) {
        const buff = Buffer.alloc(1);
        buff.writeUIntBE(delta, 0, 1);
        return buff;
    } else if(delta<128*128) {
        const buff = Buffer.alloc(2);
        const b1 = Math.floor(delta/128);
        const b2 = delta % 128;
        buff.writeUIntBE(b1+128, 0, 1);
        buff.writeUIntBE(b2, 1, 1);
        return buff;
    } else if(delta<128*128*128) {
        const buff = Buffer.alloc(3);
        const b12 = Math.floor(delta/128);
        const b1 = Math.floor(b12/128);
        const b2 = b12 % 128;
        const b3 = delta % 128;
        buff.writeUIntBE(b1+128, 0, 1);
        buff.writeUIntBE(b2+128, 1, 1);
        buff.writeUIntBE(b3, 2, 1);
        return buff;
    } else if(delta<128*128*128*128) {
        const buff = Buffer.alloc(4);
        const b12 = Math.floor(delta/(128*128));
        const b1 = Math.floor(b12/128);
        const b2 = b12 % 128;
        const b34 = delta % (128*128);
        const b3 = Math.floor(b34/128);
        const b4 = b34 % 128;
        buff.writeUIntBE(b1+128, 0, 1);
        buff.writeUIntBE(b2+128, 1, 1);
        buff.writeUIntBE(b3+128, 2, 1);
        buff.writeUIntBE(b4, 3, 1);
        return buff;
    }
}

function deltaCompressionV3(sortedArray) {
    let lastElement = 0;
    const bufferArr = [];
    for(let element of sortedArray) {
        const delta = element-lastElement;
        bufferArr.push(numToBuffer(delta));
        lastElement = element;
    }
    return Buffer.concat(bufferArr);
}

function deltaCompressionV4(sortedArray) {
    let lastElement = 0;
    const bufferArr = [];
    for(let element of sortedArray) {
        const delta = element-lastElement;
        const buff = Buffer.alloc(3);
        buff.writeUIntBE(delta, 0, 3);
        bufferArr.push(buff);
        lastElement = element;
    }
    return Buffer.concat(bufferArr);
}

function deltaDecompressionV3(dataBuffer) {
    let lastElement = 0;

    const arr = [];

    let pointer = 0;
    let currentLength = 0;
    let sum = 0;
    while(pointer<dataBuffer.length) {
        let b = dataBuffer[pointer];
        currentLength++;
        if(b<128) {
            sum *= 128;
            sum += b;

            lastElement += sum;
            arr.push(lastElement);

            currentLength = 0;
            sum = 0;
        } else {
            sum *= 128;
            sum += b-128;
        }
        pointer++;
    }

    return arr;
}

function compress(buff) {
    return zlib.gzipSync(buff);
    //return zstd.compressSync(buff);
}

console.log("Block list size: ", blockNums.length);

const blockNumDeltaCompressed = deltaCompressionV3(blockNums);

const dataLengthBuffers = [];
const blockEntriesBuffers = [];

for(let block of blockNums) {
    const sealArr = blockSealArr[block];

    dataLengthBuffers.push(numToBuffer(sealArr.length));

    // const dataLenBuff = Buffer.alloc(3);
    // dataLenBuff.writeUIntBE(sealArr.length, 0, 3);
    // dataLengthBuffers.push(dataLenBuff);

    blockEntriesBuffers.push(deltaCompressionV3(sealArr));
}

const dataLengths = Buffer.concat(dataLengthBuffers);
const blockEntries = Buffer.concat(blockEntriesBuffers);

const finalBuffer = Buffer.concat([
    blockNumDeltaCompressed,
    dataLengths,
    blockEntries
]);

console.log("Final size after delta compression: ", finalBuffer.length);

const compressed = compress(finalBuffer);

console.log("Final size after zlib compression: ", compressed.length);