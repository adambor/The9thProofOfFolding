const {numToBuffer, bufferToNum} = require("./varInt");

function deltaDecompression(dataBuffer, elementCount) {
    let lastElement = -1;

    const arr = [];

    let pointer = 0;
    while(pointer<dataBuffer.length) {
        const {value, bytesRead} = bufferToNum(dataBuffer, pointer);
        lastElement += value+1;
        arr.push(lastElement);
        pointer += bytesRead;
    }

    return arr;
}

function getDeltaDistribution(sortedArray) {
    const deltaDistribution = {};

    let lastElement = 0;
    for(let element of sortedArray) {
        let delta = element-lastElement;
        lastElement = element;

        delta--;
        for(let i=0;i<32;i++) {
            const num = Math.pow(2, i);
            if(delta<num) {
                if(deltaDistribution[i]==null) deltaDistribution[i] = 0;
                deltaDistribution[i]++;
                break;
            }
        }
    }

    return deltaDistribution;
}

function deltaCompression(sortedArray) {
    let lastElement = -1;
    const bufferArr = [];
    for(let element of sortedArray) {
        let delta = element-lastElement-1;
        bufferArr.push(numToBuffer(delta));
        lastElement = element;
    }

    return Buffer.concat(bufferArr);
}

module.exports = {
    deltaCompression,
    deltaDecompression
};
