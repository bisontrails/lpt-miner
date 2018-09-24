# lpt-miner
## A LivePeer Multi ETH Address Multi Merkle Miner

lpt-miner is a simple node app that interacts with the [MultiMerkleMine](https://etherscan.io/address/0x182ebf4c80b28efc45ad992ecbb9f730e31e8c7f) Ethereum contract. As of July 26th, 2018, the Livepeer protocol specifies that 2.44 LPT can be generated into 2.59M Ethereum accounts totaling a release of 6.3M LPT. These tokens are available for anyone to claim on a first-come first-serve basis. This script was built in order to automatically claim those tokens. For more info about LivePeer Merkle Mining check out [this link](https://forum.livepeer.org/t/the-economics-of-generating-livepeer-token-after-the-merklemine-slow-start-ends-and-claim-period-begins-on-7-26/317).

lpt-miner can mine simultaneously across any number of Ethereum addresses. It creates, signs, submits and monitors transactions for each address it is configured to use. When a transaction is completed, it automatically submits a new one. It monitors gas prices and adjusts automatically to the current safe low gas price returned from [ethgasstation.info](ethgasstation.info).

## Prerequisites

### Git
Have the git command line tool installed

### Node & npm
Make sure to have node v8 and npm installed before working with this repo

### Redis server

In order to run lpt-miner you need a local redis server running. You don't need to do anything custom just get it running. Install redis-server using your favorite package manager (apt-get, homebrew, etc) or you can [install directly](https://redis.io/topics/quickstart) although this is a bit harder. When it is installed just open a new terminal or run:

    redis-server &

### Mysql server

This version of the script uses a local mysql database to keep track of the addresses. You will need to run a local mysql instance and have a database called `livepeer` with a user called `livepeer` that has full permissions on that database. The script will automatically create the table and insert and track the usage of the LPT addresses.

To build the database run this in a terminal window:

    node --max-old-space-size=2048 compile-addresses.js
    
Once the initial database insert has been completed and the script has found some unmined addresses you can run npm start (described below) along side this script.

## Clone Repo
Make sure you have git installed and clone the repo --

    git clone git@github.com:BisonTrails/lpt-miner.git
    
Then move into the directory:

    cd lpt-miner
    
    
## Installation

    npm install


## Setup


### UTC JSON Keystore
Have your UTC JSON keystore files in a directory that the script has access to. These files are generated when you create an Ethereum wallet and can be used as is. For example myetherwallet gives you one of these keystore files. For more on keystore files, [check out this link](https://medium.com/@julien.maffre/what-is-an-ethereum-keystore-file-86c8c5917b97). 

* Make sure you have some ETH in your wallet!

### .env file setup
There is a .env.example file. Make a copy of this file and save it as .env. You can then update that file with your own address information and lpt-miner settings. The environment settings are described below -- 


### Environment Settings

    MAX_GAS_PRICE - Maximum gas price in Wei that you would like txn-looper to submit txns at
    MIN_GAS_PRICE - Minimum gas price in Wei that you would like txn-looper to submit txns at
    
    KEY_LOCATION - This is where your keystore folder is. Make sure that this folder has another folder in it called 'keystore' where your UTC JSON key files are stored
    
    NUMBER_ADDRESS_PER_TXN - This is the number of addresses the script will mine per transaction. Maximum of 40, minimum of 1.
    
    YOUR_ADDRESSES - A comma seperated list of Ethereum addresses to mine with
    KEY_PASSWORDS - A three-comma seperated list of passwords for each of your keys, in the same order as your keys
    LAST_TXNS - A comma seperated list of the last *outgoing* transaction from your Ethereum addresses, in the same order as your keys






## Start mining!
You should be all set and ready to mine lots of LPT to bond to [our LivePeer transcoder](https://explorer.livepeer.org/accounts/0xda43d85b8d419a9c51bbf0089c9bd5169c23f2f9/transcoding) (or any one elses :-D) --

    npm start
    
Once you have mined LPT, to begin participating in the network even more make sure to bond to a Transcoder ([like ours](https://explorer.livepeer.org/accounts/0xda43d85b8d419a9c51bbf0089c9bd5169c23f2f9/transcoding)). Through using a browser wallet plugin like [MetaMask](https://metamask.io/) you can visit any transcoder page and bond directly to a transcoder which allows you to earn inflation and rewards when that transcoder completes jobs.
    
## Feedback welcome!
Please give us feedback or ask questions in the issues for this repo. We will try to support it as best as we can.


## Shotouts
Thanks to the LivePeer team for working on the whole awesome network and the MerkleMine library. And thanks to Chris Remus for helping me debug through installing and running this app on other computers besides my own.
