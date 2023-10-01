The 9th Proof of Folding

Abstract:
	The main idea is to solve interactivity and scalability requirements for the original Prime proposal. To do this we try to think about the most compressed form of a single-use-seal, and then provide the list of closed seals in every block, this makes the block size O(n) instead of O(1), however if we keep the scaling factor (bytes needed to represent a seal) low, this still results in 100x improvement in througput over current bitcoin blockchain. We need to include a list of closed seals in every block to achieve non-interactivity of the protocol.

Transaction:
	Transaction in prime is similar to bitcoin transaction, with the UTXOs replaced with single-use-seals. Each transaction has one or more input single-use-seals (each of the inputs need to be satisfied with a valid scriptSig), commits to a data hash (e.g. RGB state transition) and optionally creates one or more new single-use-seals.

Seal definition:
	To keep the single-use-seal definition as compact as possible we decided to use a tuple of (u24, u24), where the first u24 represents the block number when the seal was open, and the second u24 represents the index of the seal in the opening block.

Utilizing succinct proofs (STARKs):
	We defined single-use-seal only as a tuple of 2 numbers with the actual single-use-seal definition (scriptPubKey/publicKey) committed in block's txs merkle root. Therefore to spend a single-use-seal, you need to provide a merkle proof to the single-use-seal opening in the prior block (as defined by the (u24, u24) tuple). The transaction is also just committed in current block's merkle root, and only single-use-seals closed in that transaction are publicly exposed in the list of closed seals included in that block.

	We need a way to succinctly prove that each transaction is valid:
		- has to spend a valid single-use-seal opened in a prior transaction
		- has valid scriptSig/signature corresponding to the publicKey/lockingScript, defined in the transaction opening the seal
		- is committed in the block's merkle root of all txns
		- all single-use-seals closed in the transaction are included in the list of closed seals
		- the sum of number of opened single-use-seals for each transaction adds up to the number of new seals opened in this block as stated in a block header

	For these proofs we utilize STARKs, since they are post-quantum, require no trusted setup and are efficient for computations with loops. STARK proof size scales logarithmically with computation size (so number of txs).

Block header:
	- hash256 - txs merkle root (merkle tree of all the transaction included in a block)
 	- hash256 - past blocks merkle root (merkle tree of all the previous blocks)
 	- u32 - timestamp
 	- u24 - number of new seals opened in this block
 	- hash256 - hash of the block body

Block body:
 	- Array<(u24, u24)> - array of closed single-use-seals
 	- 400-500kB - STARK proof (grows logarithmically with number of txs)

 	NOTE: Array<[u24, u24]> is an array of single-use-seals sequence numbers (which can be enforceably sorted), this allows us to further shrink the size of the array in a block by using delta compression (by storing the differences between adjacent elements in the array). We can then run a compression algorithm on top such as gzip (resulting in ~2 bytes per element) or brotli (resulting in ~1.8 bytes per element).

Transaction:
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

Ephemeral data:
	- with every block mined, there is certain amount of ephemeral data released, this contains tx ids (transaction hashes) of all the transactions included in the block's merkle root, this is used by currently transacting parties to compute the merkle proofs that are then stored by them
	- amount of this ephemeral data is 32 bytes * #txs_per_block, for a block of 2^20 txs, this results in 32 MB of ephemeral data released
	- there could be independent parties storing this ephemeral data for short periods of time (1-2 weeks), these parties would compute the merkle path on request for users, while users pay a small fee for their service, this service would be essential for lightning network, as in case of force closure other party might not be readily online to collect the proof
	- blocks without ephemeral data released should be discarded by the nodes in the network (not sure if this is possible, since not all nodes will be interested in collecting the ephemeral data for a block - only parties transacting in that block)

Chain state:
	- every seal that's ever closed in a block must be put into some set by the full nodes, this set is then used to verify that single-use-seals closed in subsequent blocks don't close an already closed single-use-seal (single-use-seal can be closed only once)

	- we use bitmaps for storing this set of spent seals, where every seal is represented as a single bit, so every block would require num_of_opened_seals/8 bytes of additional chain state storage
	- if we take the average output count per transaction in bitcoin, which is currently 3 (https://bitcoinvisuals.com/chain-output-count-tx), we see that on average maximum number of opened seals per block is 3 * #txs_per_block. For 2^20 txs per block this gives us a chain state growth of around 384kB per block

	- note that this means that for a full block, there are #txs_per_block random read/writes to the persistent storage
	- we can offset most of the read/writes by storing last N days of chain state in the RAM, e.g. with current bitcoin spending habits 95% of txs are spending a seal that is no more than 90 days old - so if we were to keep last 90 days of chain state in RAM this would result in only 5% of #txs_per_block requiring a random read/write of persistent storage
	- a block of 2^20 txs produced every 600 seconds, would require 1700 IOPS random read/writes with no caching in RAM, or 85 IOPS of random read/writes with 5GBs of RAM (storing last 90 days of chainstate)

