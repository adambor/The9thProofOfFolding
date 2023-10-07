
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

function generateSealTuples(txsPerBlock, avgOutsPerTx, currBlock) {
    //Data about the txs per block and seals opened in a single block
    const openedSealsPerBlock = avgOutsPerTx*txsPerBlock;
    const blockMultiplier = openedSealsPerBlock; //Must be strictly larger than openedSealsPerBlock

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


    //Map seals to tuples: [block, sealNum]
    return sealArr.map(e => {
        const block = Math.floor(e/blockMultiplier);
        const sealNum = e-(block*blockMultiplier);
        return [
            block,
            sealNum
        ];
    });
}

module.exports = {
    generateSealTuples
};