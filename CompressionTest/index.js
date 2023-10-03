const zlib = require("zlib");
const {deltaCompression} = require("./deltaCompression");
const {numToBuffer} = require("./varInt");
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

//Data about the txs per block and seals opened in a single block
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


//Map seals to tuples: {block, sealNum}
const sealObjArr = sealArr.map(e => {
    const block = Math.floor(e/blockMultiplier);
    const sealNum = e-(block*blockMultiplier);
    return {
        block,
        sealNum
    };
});

const blockSealArr = {};

//Create a dict mapping {[block_num]: Array<sealNum>}
sealObjArr.forEach(e => {
    if(blockSealArr[e.block]==null) blockSealArr[e.block] = [];
    blockSealArr[e.block].push(e.sealNum);
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
