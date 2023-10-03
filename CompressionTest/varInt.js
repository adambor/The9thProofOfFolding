
/*
Binary prefixes:
7 bits - 8 bits
14 bits - 16 bits
21 bits - 24 bits
29 bits - 32 bits
 */
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

function bufferToNum(buffer, startPoint) {
    let pointer = startPoint || 0;
    let currentLength = 0;
    while(pointer<buffer) {
        let b = dataBuffer[pointer];
        currentLength++;
        if(b<128) {
            sum *= 128;
            sum += b;

            return {
                value: sum,
                bytesRead: currentLength
            };
        } else {
            sum *= 128;
            sum += b-128;
        }
        pointer++;
    }

    return null;
}

module.exports = {
    numToBuffer,
    bufferToNum
};
