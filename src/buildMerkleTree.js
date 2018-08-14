const { makeTree, getAccountsBuf } = require("../../merkle-mine/client/lib/helpers");

module.exports = async () => {
    const accountsBuf = await getAccountsBuf('./../QmQbvkaw5j8TFeeR7c5Cs2naDciUVq9cLWnV3iNEzE784r')
    console.log("Retrieved accounts!");

    console.log("Creating Merkle tree...");
    const merkleTree = await makeTree(accountsBuf);
    console.log(`Created Merkle tree with root ${merkleTree.getHexRoot()} and ${merkleTree.getNumLeaves()} leaves`)
    return merkleTree;
};