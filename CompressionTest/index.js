const zlib = require("zlib");
const {deltaCompression} = require("./deltaCompression");
const {numToBuffer} = require("./varInt");
const {generateSealTuples} = require("./sealData");
//const zstd = require('@skhaz/zstd');

//Data about the txs per block and seals opened in a single block
const txsPerBlock = 1024*1024;
const avgOutsPerTx = 3;
const currBlock = 5476272;

const sealObjArr = generateSealTuples(txsPerBlock, avgOutsPerTx, currBlock);

const blockSealArr = {};

//Create a dict mapping {[block_num]: Array<sealNum>}
sealObjArr.forEach(e => {
    if(blockSealArr[e[0]]==null) blockSealArr[e[0]] = [];
    blockSealArr[e[0]].push(e[1]);
});

//Extract keys (block heights) from dict
const blockNums = Object.keys(blockSealArr).map(e => parseInt(e));
console.log("Block list size: ", blockNums.length);

//Compress block heights with delta compression
const blockNumDeltaCompressed = deltaCompression(blockNums);

const dataLengthBuffers = [];
const blockEntriesBuffers = [];
for(let block of blockNums) {
    const sealArr = blockSealArr[block];

    //Buffer of seal array lengths for each block height
    dataLengthBuffers.push(numToBuffer(sealArr.length));
    //Encoded deltaCompressed array of seals in each block
    blockEntriesBuffers.push(deltaCompression(sealArr));
}

//Buffer of seal array lengths per block
const dataLengths = Buffer.concat(dataLengthBuffers);

//Buffer of seal arrays (delta compressed and concatenated)
const blockEntries = Buffer.concat(blockEntriesBuffers);

//Final seal set buffer
const finalBuffer = Buffer.concat([
    numToBuffer(blockNums.length),
    blockNumDeltaCompressed,
    dataLengths,
    blockEntries
]);

console.log("Final size after delta compression: ", finalBuffer.length);

//Compress using gzip, alternatively brotli can be used, but that takes longer to run the compression
const startTime = Date.now();
const compressed = zlib.gzipSync(finalBuffer, {
    chunkSize: 16*1024,
    windowBits: 15,
    level: 9,
    memLevel: 9,
    strategy: 3
});
console.log("ZLIB compression time: ", Date.now()-startTime);

console.log("Final size after zlib compression: ", compressed.length);
