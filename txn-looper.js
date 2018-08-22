require('dotenv').config()
const bluebird = require('bluebird');
const fetch = require('node-fetch');
const Web3 = require("web3");
const redis = require("redis");
bluebird.promisifyAll(redis);

const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io"));

const mineLpt = require('./src/mine-lpt.js');
const buildMerkleTree = require('./src/buildMerkleTree.js');

let lastTxn = '0xa974db9cf0263f835f025865bff1c2e8141d9de39883d9a1ba58d29cf46bfefe';
let txnCheck = 0;
let merkleTree = null;
let history = {};
let loadedHistory = false;
let lastPrice = 6510000099;
const client = redis.createClient();



const checkTransaction = async () => {
    if (merkleTree == null) {
        merkleTree = await buildMerkleTree();
    }
    if (!loadedHistory) {
        await loadHistory();
        loadedHistory = true;
    }
    try {
        console.log('(' + txnCheck + ') Checking transaction ' + lastTxn);
        const txn = await web3.eth.getTransaction(lastTxn);
        if (txn != null && txn.blockNumber != null) {
            console.log('txn completed...');
            const txnReceipt = await web3.eth.getTransactionReceipt(lastTxn);
            await saveTxnDetails(lastTxn, txn, txnReceipt);
            client.set('lpt-txn-looper.history', JSON.stringify(history));
            calculateDetails();
            //new thing
            try {
                await createLptTxn(true);
            } catch(ex) {
                console.log('error creating txn', ex);
            }
        } else {
            txnCheck++;
            if (txnCheck > 25) {
                try {
                    console.log('txn not completed, creating new one in its place...');
                    await setTransactionToPrevious();
                    await createLptTxn(false);
                } catch (e) {
                    console.log('error recreating txn', e);
                }
            }
        }
    } catch (ex) {
        console.log('some general exception', ex);
    }
    checkTransactionWithTimeout();

};

const createLptTxn = async (isNew) => {
    const gasPrice = await getSafeGasPrice();
    if (isNew || gasPrice > lastPrice) {
        const txnHashs = await mineLpt(gasPrice, merkleTree);
        lastTxn = txnHashs[0];
        lastPrice = gasPrice;
    }
    txnCheck = 0;
};

const checkTransactionWithTimeout = async () => {
    setTimeout(() => {
        try {
            checkTransaction();
        } catch (ex) {
            checkTransactionWithTimeout();
        }
    }, 1000*20);
};

checkTransaction();

const loadHistory = async () => {
    const historyString = await client.getAsync('lpt-txn-looper.history');
    if (historyString == null || historyString == '') {
        return;
    }
    history = JSON.parse(historyString);
};

const saveTxnDetails = async (txnHash, txn, txnReceipt) => {
    const price = await fetch('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD');
    const priceJson = await price.json();
    history[lastTxn] = {};
    history[lastTxn].transaction = txn;
    history[lastTxn].receipt = txnReceipt;
    history[lastTxn].price = priceJson;
};

const setTransactionToPrevious = async () => {
    let redisNonce = parseInt(await client.getAsync('eth_redis_nonce'));
    redisNonce--;
    client.set('eth_redis_nonce', redisNonce);
};

const calculateDetails = () => {
    let total = 0.0;
    for(var key in history  ) {
        try {
            const gasUsed = history[key].receipt.gasUsed;
            const gasPrice = history[key].transaction.gasPrice;
            const ethPrice = history[key].price["USD"];
            const paid = gasUsed*gasPrice*ethPrice/1000000000000000000;
            // console.log('paid $' + paid.toFixed(2) + ' used ' + gasUsed + ' at ' + gasPrice + ' at ' + ethPrice);
        total += paid;
        } catch (ex) {
            //fail silently on printing :-/
        }
    }
    console.log('Purchased $' + total + ' so far.');
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
    return tmp;
};