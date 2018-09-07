# lpt-miner
## A LivePeer Multi ETH Address Multi Merkle Miner

lpt-miner is a simple node app that interacts with the [MultiMerkleMine](https://etherscan.io/address/0x182ebf4c80b28efc45ad992ecbb9f730e31e8c7f) Ethereum contract. As of July 26th, 2018, the Livepeer protocol specifies that 2.44 LPT can be generated into 2.59M Ethereum accounts totaling a release of 6.3M LPT. These tokens are available for anyone to claim on a first-come first-serve basis. This script was built in order to automatically claim those tokens. For more info about LivePeer Merkle Mining check out [this link](https://forum.livepeer.org/t/the-economics-of-generating-livepeer-token-after-the-merklemine-slow-start-ends-and-claim-period-begins-on-7-26/317).

lpt-miner can mine simultaneously across any number of Ethereum addresses. It creates, signs, submits and monitors transactions for each address it is configured to use. When a transaction is completed, it automatically submits a new one. It monitors gas prices and adjusts automatically to the current safe low gas price returned from [ethgasstation.info](ethgasstation.info).

## Clone Repo
Make sure you have git installed and clone the repo --

    git clone git@github.com:BisonTrails/lpt-miner.git
    
Then move into the directory:

    cd lpt-miner
    
    
## Install with:

    npm install


## Setup:

Have your UTC JSON keystore files in a directory that the script has access to. For more on keystore files, [check out this link](https://medium.com/@julien.maffre/what-is-an-ethereum-keystore-file-86c8c5917b97).

## Redis server

In order to run lpt-miner you need a local redis server running. You don't need to do anything custom just get it running. Install redis-server using your favorite package manager (apt-get, homebrew, etc) or you can [install directly](https://redis.io/topics/quickstart) although this is a bit harder. When it is installed just open a new terminal or run:

    redis-server &
    



### Environment Settings

    MAX_GAS_PRICE - Maximum gas price in Wei that you would like txn-looper to submit txns at
    MIN_GAS_PRICE - Minimum gas price in Wei that you would like txn-looper to submit txns at
    
    KEY_LOCATION - This is where your keystore folder is. Make sure that this folder has another folder in it called 'keystore' where your UTC JSON key files are stored
    
    NUMBER_ADDRESS_PER_TXN - This is the number of addresses the script will mine per transaction. Maximum of 40, minimum of 1.
    
    YOUR_ADDRESSES - A comma seperated list of Ethereum addresses to mine with
    KEY_PASSWORDS - A three-comma seperated list of passwords for each of your keys, in the same order as your keys
    LAST_TXNS - A comma seperated list of the last *outgoing* transaction from your Ethereum addresses, in the same order as your keys


## Start by running:

    npm start
