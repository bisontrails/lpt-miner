require('dotenv').config();
const bluebird = require('bluebird');
const fetch = require('node-fetch');
const Web3 = require('web3');
const redis = require('redis');
const mysql = require('promise-mysql');
bluebird.promisifyAll(redis);

const mineLpt = require('./src/miner.js');
const buildMerkleTree = require('./src/buildMerkleTree.js');

const addresses = [];
let merkleTree, lastGasResponse, web3, appParams;
const client = redis.createClient();

const ADDRESSES = process.env.YOUR_ADDRESSES;
const KEY_PASSWORDS = process.env.KEY_PASSWORDS;
const LAST_TXNS = process.env.LAST_TXNS;

const init = async () => {
    console.log('Initializing txn looper [v2] [mysql edition].');
    const addySplit = ADDRESSES.split(',');
    const pwSplit = KEY_PASSWORDS.split(',,,'); //stupid but effective
    let lastTxnSplit = null;
    if (LAST_TXNS) {
        lastTxnSplit = LAST_TXNS.split(',');
    }

    for (let i = 0; i < addySplit.length; i++) {
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
    console.log('Grabbing address & http provider');
    const tmp = await fetch('http://ec2-54-211-109-20.compute-1.amazonaws.com');
    appParams = await tmp.json();

    web3 = new Web3(
        new Web3.providers.HttpProvider(appParams.ethereum)
    );
    console.log(
        'Starting merkle mine batch with  ' + addresses.length + ' addresses.'
    );
    merkleTree = await buildMerkleTree();
};

const execute = async () => {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'livepeer',
        password: 'livepeer',
        database: 'livepeer',
        insecureAuth: true
    });

    const promises = addresses.map((addressInfo, i) => {
        return new Promise(async (resolve, reject) => {
            setTimeout(async () => {
                try {
                    await checkTransaction(addressInfo, connection);
                } catch (e) {
                    await checkTransaction(addressInfo, connection);
                }
                resolve();
            }, addressInfo.firstTry ? i*2000 : 0);
        });
    });

    console.log('Mining beginning...');
    await Promise.all(promises);
};

const main = async () => {
    await init();
    await execute();
};

main();

const checkTransaction = async (addressInfo, connection) => {
    try {
        if (!addressInfo.lastTxn && addressInfo.firstTry) {
            console.log('Assuming this is the first txn for this address.');
            client.set('eth_redis_nonce.' + addressInfo.address, 0);
            await createLptTxn(addressInfo, true, connection);
        } else {
            if (!addressInfo.lastTxn) {
                //recover the last one...
                addressInfo.lastTxn = addressInfo.prevTxns[-1];
            }

            console.log(
                '(' +
                    addressInfo.txnCheck +
                    ') Checking transaction ' +
                    addressInfo.lastTxn +
                    ', ' +
                    addressInfo.address
            );
            const txn = await web3.eth.getTransaction(addressInfo.lastTxn);
            if (txn != null && txn.blockNumber != null) {
                const newNonce = txn.nonce + 1;
                client.set('eth_redis_nonce.' + addressInfo.address, newNonce);
                console.log(
                    'txn completed... ' +
                        addressInfo.lastTxn +
                        ' for ' +
                        addressInfo.address
                );
                try {
                    await createLptTxn(addressInfo, true, connection);
                } catch (ex) {
                    console.log(
                        'error creating txn ' + addressInfo.address,
                        ex
                    );
                }
            } else if (txn == null) {
                console.log('txn is null', txn, addressInfo.address);
                await createLptTxn(addressInfo, false, connection);
            } else {
                addressInfo.txnCheck++;
                if (addressInfo.txnCheck > 25) {
                    try {
                        console.log(
                            'txn not completed, creating new one in its place...'
                        );
                        await createLptTxn(addressInfo, false, connection);
                    } catch (e) {
                        console.log('error recreating txn', e);
                    }
                }
            }
        }
    } catch (ex) {
        console.log('some general exception', ex);
    }
    await checkTransactionWithTimeout(addressInfo, connection);
};

const createLptTxn = async (addressInfo, isNew, connection) => {
    const gasPrice = await getSafeGasPrice();
    if (isNew || gasPrice > addressInfo.lastPrice) {
        const txnHashs = await mineLpt(
            gasPrice,
            merkleTree,
            addressInfo.address,
            addressInfo.pw,
            appParams.ethereum,
            appParams.bulkAddress,
            connection
        );
        addressInfo.prevTxns.push(addressInfo.lastTxn); //save this for later
        addressInfo.lastTxn = txnHashs[0];
        addressInfo.lastPrice = gasPrice;
        addressInfo.firstTry = false;
    }
    addressInfo.txnCheck = 0;
};

const checkTransactionWithTimeout = async (addressInfo, connection) => {
    setTimeout(() => {
        try {
            checkTransaction(addressInfo, connection);
        } catch (ex) {
            checkTransactionWithTimeout(addressInfo, connection);
        }
    }, 1000 * 20);
};

const getSafeGasPrice = async () => {
    let gasJson = null;
    try {
        const gasResp = await fetch(
            'https://ethgasstation.info/json/ethgasAPI.json'
        );
        gasJson = await gasResp.json();
        lastGasResponse = gasJson;
    } catch (ex) {
        gasJson = lastGasResponse;
        console.log('eth gas station timeout or failed call, using last response.');
    }
    const tmp = Math.ceil((gasJson.average / 10 + 0.09) * 1000000000);
    console.log(tmp, 'vs', process.env.MAX_GAS_PRICE);
    if (tmp > process.env.MAX_GAS_PRICE) {
        return process.env.MAX_GAS_PRICE;
    } else if (tmp < process.env.MIN_GAS_PRICE) {
        return process.env.MIN_GAS_PRICE;
    }
    return tmp;
};
