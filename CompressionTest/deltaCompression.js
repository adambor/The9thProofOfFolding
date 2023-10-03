const {numToBuffer, bufferToNum} = require("./varInt");

function deltaDecompression(dataBuffer, elementCount) {
    let lastElement = 0;

    const arr = [];

    let pointer = 0;
    while(pointer<dataBuffer.length) {
        const {value, bytesRead} = bufferToNum(dataBuffer, pointer);
        lastElement += value;
        arr.push(lastElement);
        pointer += bytesRead;
    }

    return arr;
}

function deltaCompression(sortedArray) {
    let lastElement = 0;
    const bufferArr = [];
    for(let element of sortedArray) {
        const delta = element-lastElement;
        bufferArr.push(numToBuffer(delta));
        lastElement = element;
    }
    return Buffer.concat(bufferArr);
}

module.exports = {
    deltaCompression,
    deltaDecompression
};
