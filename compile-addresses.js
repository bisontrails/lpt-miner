const {
    makeTree,
    getAccountsBuf
} = require('merkle-mine/client/lib/helpers.js');
// const { sha3 } = require("ethereumjs-util")

const mysql = require('promise-mysql');
const Web3 = require('web3');
const fetch = require('node-fetch');
const MerkleMineGenerator = require('merkle-mine/client/lib/MerkleMineGenerator');
const buildMerkleTree = require('./src/buildMerkleTree.js');

const initialInsert = async () => {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'livepeer',
        password: 'livepeer',
        database: 'livepeer',
        insecureAuth: true
    });

    await connection.query(
        'CREATE TABLE IF NOT EXISTS `livepeer`.`livepeer` (\n' +
            '    `address` VARCHAR(200) UNIQUE NOT NULL,\n' +
            '    `mined` BOOLEAN NOT NULL DEFAULT false\n' +
            ') ENGINE=INNODB;'
    );

    const accountsBuf = await getAccountsBuf(
        './data/QmQbvkaw5j8TFeeR7c5Cs2naDciUVq9cLWnV3iNEzE784r'
    );

    const rows = await connection.query(
        'select count(\'\') from `livepeer`.`livepeer`'
    );

    const num = parseInt(rows[0]['count(\'\')'].toString(), 10);

    if (num >= 2598071) {
        console.log("Already inserted all the addresses! YAY.");
        return;
    }

    let accounts = [];

    for (let i = 0; i < accountsBuf.length; i += 20) {
        const buf = Buffer.from(accountsBuf.slice(i, i + 20), 'hex');

        const add = '0x' + buf.toString('hex');
        try {
            await connection.query(
                'INSERT INTO `livepeer`.`livepeer` (address, mined) VALUES (?, true)',
                add
            );
            console.log('added', add);
        } catch (ex) {
            console.log('error adding', add);
        }

        accounts.push(add);
    }

    console.log('Inserted ' + accounts.length + ' into mysql database.');
    console.log(accounts.length);
};

const updateAll = async () => {

    const merkleTree = await buildMerkleTree();


    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'livepeer',
        password: 'livepeer',
        database: 'livepeer',
        insecureAuth: true
    });


    const rows = await connection.query(
        'select address, mined from `livepeer`.`livepeer`'
    );

    const tmp = await fetch('http://ec2-54-211-109-20.compute-1.amazonaws.com');
    appParams = await tmp.json();

    const provider = new Web3(
        new Web3.providers.HttpProvider(appParams.ethereum)
    );

    console.log('checking on ' + rows.length + ' addresses to see their mining status.');

    for (let i = 0; i < rows.length; i++) {
        try {
            const addy = rows[i]['address'];
            const gen = new MerkleMineGenerator(
                provider,
                merkleTree,
                '0x8e306b005773bee6ba6a6e8972bc79d766cc15c8',
                addy
            );

            console.log(rows[i]);

            const merkleMine = await gen.getMerkleMine();
            const generated = await merkleMine.methods
                .generated(addy)
                .call();
            if (generated) {
                await connection.query("UPDATE `livepeer`.`livepeer` SET mined = true WHERE address = ?", addy);
                console.log('already generated for ' + addy);
            } else {
                await connection.query("UPDATE `livepeer`.`livepeer` SET mined = false WHERE address = ?", addy);
                console.log('not already generated for ' + addy);
            }
        } catch (ex) {
            console.log('woops');
        }
    }
};

const run = async () => {
    await initialInsert();
    await updateAll();
};

run();
