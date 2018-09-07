require('dotenv').config()
const bluebird = require('bluebird');
const fetch = require('node-fetch');
const Web3 = require("web3");
const redis = require("redis");
bluebird.promisifyAll(redis);

const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io"));

const mineLpt = require('./src/mine-lpt-2.js');
const buildMerkleTree = require('./src/buildMerkleTree.js');

const addresses = [];
let merkleTree = null;
const client = redis.createClient();

const ADDRESSES = process.env.YOUR_ADDRESSES;
const KEY_PASSWORDS = process.env.KEY_PASSWORDS;
const LAST_TXNS = process.env.LAST_TXNS;

const init = async () => {
    console.log("Initializing txn looper [v2].");
    const addySplit = ADDRESSES.split(',');
    const pwSplit = KEY_PASSWORDS.split(',,,'); //stupid but effective
    let lastTxnSplit = null;
    if (LAST_TXNS) {
        lastTxnSplit = LAST_TXNS.split(',');
    }

    for (let i = 0; i<addySplit.length; i++) {
        addresses.push({
            address: addySplit[i],
            pw: pwSplit[i],
            lastTxn: lastTxnSplit ? lastTxnSplit[i] : null,
            prevTxns: [],
            txnCheck: 0,
            lastPrice: 6510000099,
            firstTry: true
        });
    }
    console.log('Starting merkle mine batch with  ' + addresses.length + ' addresses.');
    merkleTree = await buildMerkleTree();
};

const execute = async () => {
    const promises = addresses.map((addressInfo => {
        return new Promise(async (resolve, reject) => {
            try {
                await checkTransaction(addressInfo);
            } catch (e) {
                await checkTransaction(addressInfo);
            }
            resolve();
        })
    }));

    console.log('Mining beginning...');
    await Promise.all(promises);
};

const main = async () => {
    await init();
    await execute();
};

main();

const checkTransaction = async (addressInfo) => {
    try {

        if (!addressInfo.lastTxn && addressInfo.firstTry) {
            console.log('Assuming this is the first txn for this address.');
            client.set('eth_redis_nonce.' + addressInfo.address, 0);
            await createLptTxn(addressInfo, true);
        } else {
            if (!addressInfo.lastTxn) {
                //recover the last one...
                addressInfo.lastTxn = addressInfo.prevTxns[-1];
            }

            console.log('(' + addressInfo.txnCheck + ') Checking transaction ' + addressInfo.lastTxn + ', ' + addressInfo.address);
            const txn = await web3.eth.getTransaction(addressInfo.lastTxn);
            if (txn != null && txn.blockNumber != null) {
                const newNonce = txn.nonce + 1;
                client.set('eth_redis_nonce.' + addressInfo.address, newNonce);
                console.log('txn completed... ' + addressInfo.lastTxn + ' for ' + addressInfo.address);
                try {
                    await createLptTxn(addressInfo, true);
                } catch (ex) {
                    console.log('error creating txn ' + addressInfo.address, ex);
                }
            } else if (txn == null) {
                console.log('txn is null', txn, addressInfo.address);
                await createLptTxn(addressInfo, false);
            } else {
                addressInfo.txnCheck++;
                if (addressInfo.txnCheck > 25) {
                    try {
                        console.log('txn not completed, creating new one in its place...');
                        await createLptTxn(addressInfo, false);
                    } catch (e) {
                        console.log('error recreating txn', e);
                    }
                }
            }
        }
    } catch (ex) {
        console.log('some general exception', ex);
    }
    await checkTransactionWithTimeout(addressInfo);

};

const createLptTxn = async (addressInfo, isNew) => {
    const gasPrice = await getSafeGasPrice();
    if (isNew || gasPrice > addressInfo.lastPrice) {
        const txnHashs = await mineLpt(gasPrice, merkleTree, addressInfo.address, addressInfo.pw);
        addressInfo.prevTxns.push(addressInfo.lastTxn); //save this for later
        addressInfo.lastTxn = txnHashs[0];
        addressInfo.lastPrice = gasPrice;
    }
    addressInfo.txnCheck = 0;
};

const checkTransactionWithTimeout = async (addressInfo) => {
    setTimeout(() => {
        try {
            checkTransaction(addressInfo);
        } catch (ex) {
            checkTransactionWithTimeout(addressInfo);
        }
    }, 1000*20);
};

const getSafeGasPrice = async () => {
    const gasResp = await fetch('https://ethgasstation.info/json/ethgasAPI.json');
    const gasJson = await gasResp.json();
    const tmp = Math.ceil(((gasJson.safeLow/10) + 0.09)*1000000000);
    console.log(tmp, 'vs', process.env.MAX_GAS_PRICE);
    if (tmp > process.env.MAX_GAS_PRICE) {
        return process.env.MAX_GAS_PRICE;
    } else if (tmp < process.env.MIN_GAS_PRICE) {
        return process.env.MIN_GAS_PRICE;
    }
    return tmp + 100000000;
};