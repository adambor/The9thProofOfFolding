const {encodeNumber} = require("./varIntV2");

// function deltaDecompression(dataBuffer, elementCount) {
//     let lastElement = 0;
//
//     const arr = [];
//
//     let pointer = 0;
//     while(pointer<dataBuffer.length) {
//         const {value, bytesRead} = bufferToNum(dataBuffer, pointer);
//         lastElement += value;
//         arr.push(lastElement);
//         pointer += bytesRead;
//     }
//
//     return arr;
// }

function deltaCompressionV2(sortedArray) {
    const buffer = Buffer.alloc(sortedArray.length*4);

    let position = 0;
    let lastElement = 0;
    for(let element of sortedArray) {
        let delta = element-lastElement-1;
        const {pointer} = encodeNumber(delta, buffer, position);
        lastElement = element;

        position = pointer;
    }

    return buffer.slice(0, Math.ceil(position/8));
}

module.exports = {
    deltaCompression: deltaCompressionV2,
    //deltaDecompression
};
