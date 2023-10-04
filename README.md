# The 9th Proof of Folding

## Abstract

The main idea is to solve the interactivity, bandwidth, and data availability requirements for [the original Prime proposal](https://github.com/LNP-BP/layer1). To do this, we try to think about the most compressed form of a single-use-seal, and then provide the list of closed seals in every block. This makes the block size O(n) instead of O(1), however if we keep the scaling factor (bytes needed to represent a seal) low, this still results in over 100x improvement in throughput over the current Bitcoin blockchain. The reason we need to include a list of closed seals in every block is to achieve non-interactivity of the protocol. This makes it so users need not to retain proofs of non-inclusion, which in the original Prime proposal amounted to 6GB per UTXO per year, and if only one proof of non-inclusion was lost or missing, the seal would become unspendable. In our proposal the proofs are of fixed size, around 1536 bytes, and can be deterministically adjusted by just syncing to the latest blockheader (no need to receive ephemeral data for every block, like is the case with original Prime proposal).

## Transaction

A transaction in our proposal is similar to a Bitcoin transaction, with the UTXOs replaced with single-use-seals. Each transaction has one or more input single-use-seals (each of the inputs need to be satisfied with a valid scriptSig), commits to a data hash (e.g. RGB state transition), and optionally creates one or more new single-use-seals.

```
-> input seal 0 --+-- data hash --+-- new seal 0 ->
-> input seal 1 --+               +-- new seal 1 ->
                                  +-- new seal 2 ->
```

## Seal definition

To keep the single-use-seal definition as compact as possible we decided to use a tuple of `(u24, u24)`, where the first u24 represents the block number when the seal was open, and the second u24 represents the index of the seal in the opening block. A block indicates how many seals it opens in a single u24, then is followed by an encoded series of seal tuples for seals to be closed within this block that were opened in prior blocks. Additional encoding optimizations can be gained from segmenting the seal closing region into seals that can make use of relative values, further reducing the number of bytes needed to represent them.

## Utilizing succinct proofs (STARKs)

We defined single-use-seal only as a tuple of 2 numbers with the actual single-use-seal definition (scriptPubKey/publicKey) committed in block's txs merkle root. Therefore to spend a single-use-seal, you need to provide a merkle proof to the single-use-seal opening in the prior block (as defined by the `(u24, u24)` tuple). The transaction is also just committed in current block's merkle root, and only single-use-seals closed in that transaction are publicly exposed in the list of closed seals included in that block.

We need a way to succinctly prove that each transaction is valid:

- has to spend a valid single-use-seal opened in a prior transaction
- has valid scriptSig/signature corresponding to the publicKey/lockingScript, defined in the transaction opening the seal
- is committed in the block's merkle root of all txns
- all single-use-seals closed in the transaction are included in the list of closed seals
- the sum of number of opened single-use-seals for each transaction adds up to the number of new seals opened in this block as stated in a block header.

For these proofs we utilize STARKs, since they are post-quantum, require no trusted setup and are efficient for computations with loops. STARK proof size scales logarithmically with computation size (in this context, number of txs), and so it makes for a much smaller proof than having to provide and verify every transaction signature. This is not necessarily a zero-knowledge version of STARK proofs, which is why we call them succinct STARKs and not zk STARKs. Client-side validation takes care of much of the zero-knowledge part already, simplifying L1 development.

## Ephemeral data

When a block is mined we need to distribute proof data for parties transacting in that block (so they can later on construct a merkle proof when spending their seals). To achieve this without interactivity we just release the tx ids (transaction signatures) of all the transactions included in a block to the network, this data is ephemeral and is not retained by the network. A transacting party can collect the tx ids (transaction signatures), see which of them corresponds to its transactions (since it knows the txid) and construct the merkle proof out of them. Amount of this ephemeral data is 56 bytes \* #txs_per_block, for a block of 2^20 txs, this results in 56 MB of ephemeral data released. Blocks without ephemeral data released should be discarded by the nodes in the network (not sure if this is possible, since not all nodes will be interested in collecting the ephemeral data for a block - only parties transacting in that block).

### Ephemeral data caching

There could be independent parties storing this ephemeral data for short periods of time (1-2 weeks). These parties would compute the merkle path on request for users, while users pay a small fee for their service. This service would be essential for the Lightning network, as in case of force closure other party might not be readily online to collect the proof.

## Chain state

Every seal closed within a block must be put into some set by the full nodes, this set is then used to verify that single-use-seals closed in subsequent blocks don't close an already closed single-use-seal (single-use-seal can be closed only once). This could be optimized via the use of [Roaring Bitmaps](https://github.com/RoaringBitmap/croaring-rs).

### Bitmaps

We will use bitmaps for persisting this set of spent seals, where every seal is represented as a single bit, so every block would require num_of_opened_seals/8 bytes of additional chain state storage.

If we take the average output count per transaction in bitcoin, which is currently 3 (https://bitcoinvisuals.com/chain-output-count-tx), we see that on average maximum number of opened seals per block is 3 \* #txs_per_block. For 2^20 txs per block this gives us a chain state growth of around 384kB per block.

### Persistent storage IOPS requirements

Note that this means that for a full block, there are #txs_per_block random read/writes to the persistent storage. We can however offset most of the read/writes by storing last N days of chain state in the RAM, e.g. with current bitcoin spending habits 95% of txs are spending a seal that is no more than 90 days old - so if we were to keep last 90 days of chain state in RAM this would result in only 5% of #txs_per_block requiring a random read/write of persistent storage.

A block of 2^20 txs produced every 600 seconds, would require 1700 IOPS random read/writes with no caching in RAM, or 85 IOPS of random read/writes with 5GBs of RAM (storing last 90 days of chainstate).

## Data structures

### Block header

- hash256 - txs merkle root (merkle tree of all the transaction included in a block)
- hash256 - past blocks merkle root (merkle tree of all the previous blocks)
- u32 - timestamp
- u24 - number of new seals opened in this block
- hash256 - hash of the block body

### Block body

- Array<(u24, u24)> - array of closed single-use-seals
- 600-700kB - STARK proof (grows logarithmically with number of txs)

NOTE: Array<(u24, u24)> is an array of single-use-seals sequence numbers (which can be enforceably sorted), this allows us to further shrink the size of the array in a block by using delta compression (by storing the differences between adjacent elements in the array). We can then run a compression algorithm on top such as gzip (resulting in ~2 bytes per element) or brotli (resulting in ~1.8 bytes per element), for a maximum block size in the vicinity of 2MB.

### Transaction (WIP)

Unsigned part:

- merkle proof down to the prior block in the block merkle tree (this proof path changes deterministically with every new block, therefore it is important for the miner's mempool to be able to augment this path)
- merkle proof of opening transaction included in the block where this seal was open
- merkle proof of this seal inside the transaction
- signature/scriptSig

Signed part:

- publicKey/lockingScript
- data/state transition commitment
- number of new opened seals
- merkle root of new opened seals

## Applications

Prime helps scale certain applications that are difficult to scale in other ways.

### Unique Digital Assets (UDAs)

UDAs, or NFTs, are unique assets and thus have no liquidity, and so there can be no Lightning Network version of a UDA. Prime can simplify what's needed to secure an RGB21 UDA, however, and thus meet scaling needs.

### Atomic Swaps

A transaction with multiple inputs and outputs between the buyer and seller can be used to perform a special kind of transaction that is trustless and permissionless, requiring no escrow service, and is entirely P2P, called a [scriptless atomic swap](https://github.com/orgs/LNP-BP/discussions/125). The buyer spends the single use seal holding their Radiant BTC, and the seller spends their single use seal holding their RGB20 or RGB21 asset. In the same transaction, two new seals are created, one for the buyer and one for the seller, just with the assets swapped between them.

### Scaling Lightning

Lightning channel opens and closes could also be coordinated using single use seals. This would be using Radiant BTC, and could be bridged out of the Prime chain to the legacy Lightning Network by nodes capable of settlement transactions via Prometheus.

#### Challenges

Current BOLT lightning implementation uses HTLCs to ensure atomicity throughout multihop payments - this depends on transparent on-chain transactions revealing the pre-image, so other parties could use the pre-image to settle their hops on the route. This might be problematic, since transaction data is not released as ephemeral data (only the txId is) when a block is mined, so it might be possible to include a transaction revealing the pre-image in a block without making it public to the network (e.g. by sending it directly to a miner). We can solve this by using PTLCs and adaptor signatures instead of HTLCs, and making transaction IDs a signature of the transaction input (instead of hash256 of the tx data), the signature already contains the hash of the transaction as an input to the EdDSA algorithm, so the signature will be unique and inherently contain a commitment to the transaction data. This means that the txId of the transaction will be 56-byte long (depending on the curve used - [P-224 seems to work over a STARK friendly field](https://ethresear.ch/t/zk-stark-for-schnorr-signature-verification/7034) and provides enough security - 112-bits) instead of 32-bytes. As this txId HAS to be released by the miner upon mining the block as ephemeral data, the signatures would be revealed - which leads to revealing the signature adaptor. Please note that Schnorr signature half-aggregation unfortunately cannot be used because that [breaks adaptor signatures](https://www.gijsvandam.nl/post/why-does-signature-half-aggregation-break-adaptor-signatures/), so this rules out [CISA](https://github.com/BlockstreamResearch/cross-input-aggregation) support.

## Conclusion

We demonstrate that the original Prime design can be extended with a different block format which can securely verify a compact seal definition using STARKs, which can support up to 2^20 (1,048,576) transactions per block. At a minimum fee of 1 sat per seal, this can net miners ~1.4 additional BTC per day while supporting over a billion batched client-side validated transactions per day, while making very efficient use of CPU, RAM, and bandwidth. This reduces the hardware requirements for running your own node, and with support for non-interactive transactions, should result in a user experience more similar to L1 than to L2.
