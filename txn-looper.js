require('dotenv').config()
const bluebird = require('bluebird');
const fetch = require('node-fetch');
const Web3 = require("web3");
const redis = require("redis");
bluebird.promisifyAll(redis);

const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io"));

const mineLpt = require('./src/mine-lpt.js');
const buildMerkleTree = require('./src/buildMerkleTree.js');

let lastTxn = '0x9d11644df218e4d2254a12f223b3894f635ae5d66f78f8aee16696e14106f4b9';
let merkleTree = null;
let history = {};
let loadedHistory = false;
const client = redis.createClient();



const checkTransaction = async () => {
    if (merkleTree == null) {
        merkleTree = await buildMerkleTree();
    }
    if (!loadedHistory) {
        await loadHistory();
        loadedHistory = true;
    }
    console.log('Checking transaction ' + lastTxn);
    const txn = await web3.eth.getTransaction(lastTxn);
    if (txn != null && txn.blockNumber != null) {
        const txnReceipt = await web3.eth.getTransactionReceipt(lastTxn);
        await saveTxnDetails(lastTxn, txn, txnReceipt);
        client.set('lpt-txn-looper.history', JSON.stringify(history));
        calculateDetails();
        //new thing
        try {
            const gasPrice = await getSafeGasPrice();
            const txnHashs = await mineLpt(gasPrice, merkleTree);
            console.log(txnHashs);
            lastTxn = txnHashs[0];
            checkTransactionWithTimeout();
        } catch(ex) {
            checkTransactionWithTimeout();
        }
    } else {
        checkTransactionWithTimeout();
    }

};

const checkTransactionWithTimeout = async () => {
    setTimeout(() => {
        checkTransaction();
    }, 1000*60);
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
}

const calculateDetails = () => {
    let total = 0.0;
    for(var key in history  ) {
        try {
            const gasUsed = history[key].receipt.gasUsed;
            const gasPrice = history[key].transaction.gasPrice;
            const ethPrice = history[key].price["USD"];
            const paid = gasUsed*gasPrice*ethPrice/1000000000000000000;
            console.log('paid $' + paid.toFixed(2) + ' used ' + gasUsed + ' at ' + gasPrice + ' at ' + ethPrice);
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