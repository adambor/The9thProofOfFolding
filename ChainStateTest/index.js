const zlib = require("zlib");
const RoaringBitmap32 = require("roaring/RoaringBitmap32");

const max = 3*1024*1024;
const spentPct = 0.33;

const arr = [];
for(let i=0;i<max;i++) {
    if(Math.random()<spentPct) {
        arr.push(i);
    }
}

console.log("Array length: ", arr.length);

const bitmap = new RoaringBitmap32(arr);
bitmap.runOptimize();
bitmap.shrinkToFit();

const roaringBuffer = bitmap.serialize(false);

console.log("Roaring buffer size: ", roaringBuffer.length);

const compressedBuffer = zlib.gzipSync(roaringBuffer);

console.log("Compressed buffer size: ", compressedBuffer.length);
