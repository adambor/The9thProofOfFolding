
const {generateSealTuples} = require("./sealData");
const fs = require("fs");

const txsPerBlock = 1024*1024;
const avgOutsPerTx = 3;
const currBlock = 5476272;

const tuplesArr = generateSealTuples(txsPerBlock, avgOutsPerTx, currBlock);

const buffers = [];

for(let tuple of tuplesArr) {
    const buffer = Buffer.alloc(6);
    buffer.writeUIntBE(tuple[0], 0, 3);
    buffer.writeUIntBE(tuple[1], 3, 3);
    buffers.push(buffer);
}

const outputBuffer = Buffer.concat(buffers);

fs.writeFileSync("sealList.bin", outputBuffer);
