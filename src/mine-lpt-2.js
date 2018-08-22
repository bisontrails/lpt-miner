require('dotenv').config()
const Web3 = require("web3");
const redis = require("redis")
const bluebird = require('bluebird');
const fetch = require('node-fetch');
bluebird.promisifyAll(redis);

const MerkleMineBulkArtifact = require("../MerkleMineBulkArtifact.json");
const { addHexPrefix } = require("ethereumjs-util")
const TxKeyManager = require("../../merkle-mine/client/lib/TxKeyManager");
const MerkleMineGenerator = require("../../merkle-mine/client/lib/MerkleMineGenerator");

const buildMerkleTree = require('./buildMerkleTree.js');

const GAS_PRICE = process.env.GAS_PRICE;
const KEY_LOCATION = process.env.KEY_LOCATION;
const NUMBER_OF_LOOPS = 1;
const NUMBER_ADDRESS_PER_TXN = process.env.NUMBER_ADDRESS_PER_TXN;


const mineLpt = async (gasPrice, merkleTree, yourAddress, keyPassword) => {
    const client = redis.createClient();

    const provider = new Web3.providers.HttpProvider("https://mainnet.infura.io");
    const merkleMineAddress = "0x8e306b005773bee6ba6a6e8972bc79d766cc15c8";

    console.log("Using the Ethereum main network, Merkle Mine contract: " + merkleMineAddress);
    if (merkleTree == null) {
        merkleTree = await buildMerkleTree();
    }
    if (gasPrice == null) {
        gasPrice = GAS_PRICE;
    }

    const txKeyManager = new TxKeyManager(KEY_LOCATION, yourAddress);
    await txKeyManager.unlock(keyPassword);

    let i = 0;
    const txnHashes = [];
    while (i < NUMBER_OF_LOOPS) {
        const { toclaim, hexproofs } = await getAddressesAndProofs(provider, merkleTree, merkleMineAddress);
        console.log('submitting with ga price of ' + gasPrice + ' for ' + yourAddress);
        const hash = await submitProof(yourAddress, toclaim, extendedBufArrToHex(hexproofs), txKeyManager, gasPrice, client);
        txnHashes.push(hash);
        i++;
    }

    return txnHashes;
};

const fetchAccounts = async () => {
    const one = await fetch('https://568kysoy9c.execute-api.us-east-1.amazonaws.com/prod/random-accounts');
    const onej = JSON.parse((await one.json()).body);
    // const two = await fetch('https://568kysoy9c.execute-api.us-east-1.amazonaws.com/prod/random-accounts');
    // const twoj = JSON.parse((await two.json()).body);
    // const three = await fetch('https://568kysoy9c.execute-api.us-east-1.amazonaws.com/prod/random-accounts');
    // const threej = JSON.parse((await three.json()).body);


    const accounts = onej;//.concat(twoj);//, threej, threej);
    console.log('Got ' + accounts.length + ' accounts to mine.');
    return accounts;
};

const getAddressesAndProofs = async (provider, merkleTree, merkleMineAddress) => {
    const accounts = await fetchAccounts();

    const toclaim = [];
    const hexproofs = [];

    for (let i=0; i<accounts.length; i++) {
        try {
            if (toclaim.length < NUMBER_ADDRESS_PER_TXN) {
                const hexAddr = accounts[i].toLowerCase();
                i++;
                const gen = new MerkleMineGenerator(provider, merkleTree, merkleMineAddress, hexAddr);

                const merkleMine = await gen.getMerkleMine();
                const generated = await merkleMine.methods.generated(hexAddr).call();

                if (generated) {
                    console.log(`Allocation for ${hexAddr} already generated!`);
                } else {
                    console.log(`Allocation for ${hexAddr} *NOT* already generated!`);
                    const proof = merkleTree.getHexProof(hexAddr);
                    toclaim.push(hexAddr);
                    hexproofs.push(proof.substr(2));
                }
            }
        } catch(ex) {
            console.log(ex);
        }
    }
    return {
        toclaim,
        hexproofs
    }

};

const submitProof = (callerAddress, addressList, merkleProofs, txKeyManager, gasPrice, redisClient) => {
    return new Promise(async (resolve, reject) => {
        const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io"));
        const merkleBulkAddress = "0x182EBF4C80B28efc45AD992ecBb9f730e31e8c7F";
        const bulkMerkleMiner = new web3.eth.Contract(MerkleMineBulkArtifact.abi, merkleBulkAddress);

        try {

            console.log('Generating txn for ' + addressList.length);
            const generateFn = bulkMerkleMiner.methods.multiGenerate(
                '8e306b005773bee6ba6a6e8972bc79d766cc15c8',
                addressList,
                merkleProofs
            );


            const data = generateFn.encodeABI();
            let nonce = await web3.eth.getTransactionCount(callerAddress);
            let nonceR = parseInt(await redisClient.getAsync('eth_redis_nonce.' + callerAddress));
            if (nonceR && nonceR > nonce) {
                nonce = nonceR;
            }
            const networkId = await web3.eth.net.getId();

            console.log('signing tx at ' + nonce);

            const signedTx = txKeyManager.signTransaction({
                nonce: nonce,
                gasPrice: gasPrice,
                gasLimit: 170000*addressList.length,
                to: addHexPrefix(merkleBulkAddress),
                value: 0,
                data: data,
                chainId: networkId
            });

            web3.eth.sendSignedTransaction(signedTx).on("transactionHash", txHash => {
                console.log(`Submitted tx ${txHash} to generate allocation for ${callerAddress} from ${callerAddress}`)
                nonce++;
                redisClient.set('eth_redis_nonce.' + callerAddress, nonce);
                resolve(txHash);
            });
        } catch (ex) {
            console.log ('big error');
            console.log(ex);
            reject();
        }
    });
};

/*
HELPERS
 */

const encodeProofSize = (proof) => {
    const proofSize = proof.length / 2

    let res = proofSize.toString('16')
    let len = res.length

    while (len < 64) {
        res = '0' + res
        len++
    }

    return res
};

const extendedBufArrToHex = (proofs) => {
    return (
        '0x' +
        proofs
            .map(proof => {
                return encodeProofSize(proof) + proof
            })
            .join('')
    )
};




module.exports = mineLpt;