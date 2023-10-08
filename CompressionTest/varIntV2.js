
function getEncodingNumAndBits(num) {

    let setNum;
    let bitLength;
    if(num===0) {
        setNum = 0b00;
        bitLength = 2;
        return {
            setNum,
            bitLength
        };
    }
    num -= 1;
    if (num<4) {
        setNum = 0b01<<2 | num;
        bitLength = 4;
        return {
            setNum,
            bitLength
        };
    }
    num -= 4;
    if (num<64) {
        setNum = 0b10<<6 | num;
        bitLength = 8;
        return {
            setNum,
            bitLength
        };
    }
    num -= 64;
    if (num<32*256) {
        setNum = 0b110<<13 | num;
        bitLength = 16;
        return {
            setNum,
            bitLength
        };
    }
    num -= 32*256;
    if (num<16*256*256) {
        setNum = 0b1110<<21 | num;
        bitLength = 24;
        return {
            setNum,
            bitLength
        };
    }
    num -= 16*256*256;
    if (num<16*256*256*256) {
        setNum = 0b1111<<28 | num;
        bitLength = 32;
        return {
            setNum,
            bitLength
        };
    }

}

function getEncodingNumAndBitsSmallest(num) {

    let setNum;
    let bitLength;
    if(num===0) {
        setNum = 0b0;
        bitLength = 1;
        return {
            setNum,
            bitLength
        };
    }
    num -= 1;
    if (num<4) {
        setNum = 0b10<<2 | num;
        bitLength = 4;
        return {
            setNum,
            bitLength
        };
    }
    num -= 4;
    if (num<32) {
        setNum = 0b110<<5 | num;
        bitLength = 8;
        return {
            setNum,
            bitLength
        };
    }
    num -= 32;
    if (num<16*256) {
        setNum = 0b1110<<12 | num;
        bitLength = 16;
        return {
            setNum,
            bitLength
        };
    }
    num -= 16*256;
    if (num<8*256*256) {
        setNum = 0b11110<<19 | num;
        bitLength = 24;
        return {
            setNum,
            bitLength
        };
    }
    num -= 8*256*256;
    if (num<8*256*256*256) {
        setNum = 0b11111<<27 | num;
        bitLength = 32;
        return {
            setNum,
            bitLength
        };
    }

}

function encodeNumber(num, buffer, position) {

    const {setNum, bitLength} = getEncodingNumAndBits(num);

    let lastBytePosition;
    let byteValue;
    for(let i=0;i<bitLength;i++) {
        const bitPosition = position%8;
        const bytePosition = Math.floor(position/8);
        if(lastBytePosition!==bytePosition) {
            if(byteValue!=null) {
                buffer.writeUIntBE(byteValue, lastBytePosition, 1);
            }
            byteValue = buffer.readUIntBE(bytePosition, 1);
            lastBytePosition = bytePosition;
        }

        byteValue |= ((setNum >> (bitLength-i-1)) & 0b1) << (7-bitPosition);

        position++;
    }

    buffer.writeUIntBE(byteValue, lastBytePosition, 1);

    return {
        bitsWritten: bitLength,
        pointer: position
    }

}

// function byteToBinaryString(s) {
//     return s.toString(2).padStart(8, '0');
// }
//
// const buffer = Buffer.alloc(5);
//
// encodeNumber(0, buffer, 0);
// encodeNumber(1, buffer, 2);
// encodeNumber(3, buffer, 6);
// encodeNumber(10, buffer, 10);
// encodeNumber(152, buffer, 18);
//
// console.log("Buffer: ", [...buffer].map(byteToBinaryString).join(" "));

module.exports = {
    encodeNumber
};