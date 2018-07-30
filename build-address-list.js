/*
MEH NOT USED REALLY.
 */


const Web3 = require("web3");
const redis = require("redis")
const bluebird = require('bluebird');

bluebird.promisifyAll(redis);

const { bufferToHex } = require("ethereumjs-util")
const MerkleTree = require("./../merkle-mine/utils/merkleTree")

const TxKeyManager = require("./../merkle-mine/client/lib/TxKeyManager");
const MerkleMineGenerator = require("./../merkle-mine/client/lib/MerkleMineGenerator");
const { makeTree, getAccountsBuf } = require("./../merkle-mine/client/lib/helpers");




const main = async () => {
    const client = redis.createClient();

    provider = new Web3.providers.HttpProvider("https://mainnet.infura.io");
    const merkleMineAddress = "0x8e306b005773bee6ba6a6e8972bc79d766cc15c8";
    console.log("Using the Ethereum main network, Merkle Mine contract: " + merkleMineAddress);

    const accountsBuf = await getAccountsBuf('./../QmQbvkaw5j8TFeeR7c5Cs2naDciUVq9cLWnV3iNEzE784r')

    let accounts = [];

    for (let i = 0; i < accountsBuf.length; i += 20) {
        const buf = Buffer.from(accountsBuf.slice(i, i + 20), "hex");

        accounts.push(buf);
    }

    console.log("Retrieved accounts!");

    console.log("Creating Merkle tree...");
    const merkleTree = new MerkleTree(accounts);
    console.log(`Created Merkle tree with root ${merkleTree.getHexRoot()} and ${merkleTree.getNumLeaves()} leaves`)

    let i = 0;
    const unclaimed = [];
    for (let i=0; i<accounts.length; i++) {
        try {
            const hexAddr = bufferToHex(accounts[i]);
            const gen = new MerkleMineGenerator(provider, merkleTree, merkleMineAddress, hexAddr);

            const merkleMine = await gen.getMerkleMine();
            const generated = await merkleMine.methods.generated(hexAddr).call();

            if (generated) {
                console.log(`Allocation for ${hexAddr} already generated!`);
            } else {
                console.log(`Allocation for ${hexAddr} *NOT* already generated!`);
                unclaimed.push(hexAddr);
            }

        } catch(ex) {
            console.log(ex);
        }
    }


    console.log(unclaimed.length + ' unclaimed addresses left.');
    client.set("eth_lpt_addresses", JSON.stringify(unclaimed));








}

try {
    main()
} catch (err) {
    console.error(err)
}