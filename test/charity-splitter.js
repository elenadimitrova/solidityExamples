const assert = require('assert');
const { BN } = require('bn.js');
const web3Utils = require('web3-utils');
Web3 = require('web3');
const { hashPersonalMessage, ecsign } = require("ethereumjs-util");

const CharitySplitter = artifacts.require("CharitySplitter");
const CharitySplitterForToken = artifacts.require("CharitySplitterForToken");
const CharitySplitterFactory = artifacts.require("CharitySplitterFactory");
const CharitySplitterFactoryV2 = artifacts.require("CharitySplitterFactoryV2");
const ERC677Token = artifacts.require("ERC677Token.sol");
const CharitySplitterMetaTx = artifacts.require("CharitySplitterMetaTx");

async function assertRevert(promise, errorMessage) {
  let receipt;
  let reason;
  try {
    await promise;
  } catch (err) {
    ({ receipt, reason } = err);
    expect(reason).to.equal(errorMessage);
  }
  // Check the receipt `status` to ensure transaction failed.
  expect(receipt.status, `Transaction succeeded, but expected error ${errorMessage}`).to.be.false;
}

contract("Charity Splitter", accounts => {
  const owner = accounts[0];
  const charity1 = accounts[1];
  const charity2 = accounts[2];
  const charity3 = accounts[3];

  let charitySplitter;
  let charitySplitterFactory;
  let charitySplitterFactoryV2;
  let charitySplitterForToken;
  let token677;
  let charitySplitterMetaTx;

  beforeEach(async () => {
    charitySplitter = await CharitySplitter.new(owner);
    charitySplitterForToken = await CharitySplitterForToken.new(owner);
    charitySplitterFactory = await CharitySplitterFactory.new();
    charitySplitterFactoryV2 = await CharitySplitterFactoryV2.new();
    charitySplitterMetaTx = await CharitySplitterMetaTx.new({ from: accounts[2] });

    token677 = await ERC677Token.new();
  });

  describe("when initialising contracts", () => {
    it("should initialise the correct CharitySplitter owner", async () => {
      const assignedOwner = await charitySplitter.owner();
      assert.equal(assignedOwner, owner);
    });

    it("should initialise the correct CharitySplitterMetaTx owner", async () => {
      const assignedOwner = await charitySplitterMetaTx.owner();
      assert.equal(assignedOwner, accounts[2]);
    });
  });

  describe("when working with charities", () => {
    it("should allow owner to add charities", async () => {
      await charitySplitter.addCharity(charity1);
      await charitySplitter.addCharity(charity2);
      await charitySplitter.addCharity(charity3);

      const newCharity1 = await charitySplitter.charities(1);
      const newCharity2 = await charitySplitter.charities(2);
      const newCharity3 = await charitySplitter.charities(3);

      assert.equal(newCharity1.enabled, true);
      assert.equal(newCharity2.enabled, true);
      assert.equal(newCharity3.enabled, true);

      const totalCharityCount = await charitySplitter.totalCharitiesCount();
      assert.equal(totalCharityCount, 3);
      const activeCharityCount = await charitySplitter.activeCharitiesCount();
      assert.equal(activeCharityCount, 3);
    });

    it("should NOT allow non-owner to add charities", async () => {
      await assertRevert(charitySplitter.addCharity(charity1, { from: accounts[4] }), "charity-splitter-access-denied");      
    });

    it("should allow owner to remove charities", async () => {
      await charitySplitter.addCharity(charity1);
      await charitySplitter.addCharity(charity2);
      await charitySplitter.addCharity(charity3);

      await charitySplitter.removeCharity(2);

      const newCharity2 = await charitySplitter.charities(2);
      assert.equal(newCharity2.enabled, false);

      const totalCharityCount = await charitySplitter.totalCharitiesCount();
      assert.equal(totalCharityCount, 3);
      const activeCharityCount = await charitySplitter.activeCharitiesCount();
      assert.equal(activeCharityCount, 2);
    });

    it("should NOT allow non-owner to remove charities", async () => {
      await charitySplitter.addCharity(charity1);
      await assertRevert(charitySplitter.removeCharity(1, { from: accounts[4] }), "charity-splitter-access-denied");      
    });

    it.skip("should allow owner to add a charity via meta tx", async () => {
      console.log("accounts[0]", accounts[0]);
      console.log("accounts[2]", accounts[2]);
      console.log("charitySplitterMetaTx", charitySplitterMetaTx.address);

      const value = 0;
      const nonce = await charitySplitterMetaTx.changeNonces();
      const data = await charitySplitter.contract.methods.addCharity(accounts[5]).encodeABI();
      const input = `0x${charitySplitterMetaTx.address.slice(2)}${charitySplitterMetaTx.address.slice(2)}${web3Utils.padLeft(value.toString(16), "64", "0")}${data.slice(2)}${web3Utils.padLeft(
        nonce.toString(16),
        "64", 
        "0"
      )}`;

      const msgHash = web3Utils.soliditySha3(input);
      const prefixedMessageHash = await hashPersonalMessage(Buffer.from(msgHash.slice(2), "hex"));
      const privateKeyAccount2 = "c3dee2ffa90365f6b1b1ab815ff122c9e51a2b5d6c80bcd167a72ded7643abbc";
      const sig = await ecsign(prefixedMessageHash, Buffer.from(privateKeyAccount2, "hex"));

      const sigV = sig.v;
      const sigR = `0x${sig.r.toString("hex")}`;
      const sigS = `0x${sig.s.toString("hex")}`;

      const balanceCoinbaseBefore = await web3.eth.getBalance(accounts[0]);
      const balanceAccount2Before = await web3.eth.getBalance(accounts[2]);
      
      await charitySplitterMetaTx.addCharityMeta(data, sigV, sigR, sigS, { gasPrice: 1 });

      const balanceCoinbaseAfter = await web3.eth.getBalance(accounts[0]);
      console.log("Cost to coinbase account", balanceCoinbaseBefore - balanceCoinbaseAfter)
      const balanceAccount2After = await web3.eth.getBalance(accounts[2]);
      console.log("Cost to account[2]", balanceAccount2Before - balanceAccount2After)
      
      const newCharity1 = await charitySplitterMetaTx.charities(1);
      assert.equal(newCharity1.charityAddress, accounts[5]);
      assert.equal(newCharity1.enabled, true);
      const totalCharityCount = await charitySplitterMetaTx.totalCharitiesCount();
      assert.equal(totalCharityCount, 1);
      const activeCharityCount = await charitySplitterMetaTx.activeCharitiesCount();
      assert.equal(activeCharityCount, 1);
    });
  });

  describe("when splitting funds between charities", () => {
    it("should fail if there are no active charities to receive the donation", async () => {
      const activeCharitiesCount = await charitySplitter.activeCharitiesCount();
      assert.equal(activeCharitiesCount, 0);

      await assertRevert(charitySplitter.send(1), "no-charities-to-distribute-value-to");      
    });

    it("should fail if the donation is too small", async () => {
      await charitySplitter.addCharity(charity1);
      await charitySplitter.addCharity(charity2);

      await assertRevert(charitySplitter.send(1), "donation-too-low-to-distribute");      
    });

    it("should split the ether donation equally between active charities", async () => {
      await charitySplitter.addCharity(charity1);
      await charitySplitter.addCharity(charity2);
      await charitySplitter.addCharity(charity3);
      await charitySplitter.removeCharity(2);

      let startingBalance1 = await web3.eth.getBalance(charity1);
      startingBalance1 = new BN(startingBalance1);
      let startingBalance2 = await web3.eth.getBalance(charity2);
      startingBalance2 = new BN(startingBalance2);
      let startingBalance3 = await web3.eth.getBalance(charity3);
      startingBalance3 = new BN(startingBalance3);

      // Send 2 wei which is split between 2 active charities (we've disabled charity 2).
      // Each charity should receive 1 wei
      await charitySplitter.send(2);

      // Appologies for the not-so-elegant numbers comparison but I haven't go thte time to properly wire in numbers handling
      const balance1 = await web3.eth.getBalance(charity1);
      assert.equal(balance1, startingBalance1.addn(1));
      const balance2 = await web3.eth.getBalance(charity2);
      assert.equal(balance2, startingBalance2);
      const balance3 = await web3.eth.getBalance(charity3);
      assert.equal(balance3, startingBalance3.addn(1));
    });

    it("should split the erc677 tokens donation equally between active charities", async () => {
      await charitySplitterForToken.addCharity(charity1);
      await charitySplitterForToken.addCharity(charity2);
      await charitySplitterForToken.addCharity(charity3);
      await charitySplitterForToken.removeCharity(2);

      // Send 2 tokens which are split between 2 active charities (we've disabled charity 2).
      // Each charity should receive 1 token
      let data = await web3Utils.soliditySha3("empty data").substr(0, 10);

      await token677.transferAndCall(charitySplitterForToken.address, 20, data)
      const balance1 = await token677.balances(charity1);
      assert.equal(balance1, 10);
      const balance2 = await token677.balances(charity2);
      assert.equal(balance2, 0);
      const balance3 = await token677.balances(charity3);
      assert.equal(balance3, 10);
    });
  });

  describe("when creating a charity splitter", () => {
    it("can create a new splitter via the factory V1", async () => {
      const existingCharitySplitterAddress = await charitySplitterFactory.charitySplitters(accounts[4]);
      assert.equal(existingCharitySplitterAddress, "0x0000000000000000000000000000000000000000");

      const tx = await charitySplitterFactory.createCharitySplitter(accounts[5], { from: accounts[4] });
      console.log("charitySplitterFactory.createCharitySplitter cost", tx.receipt.gasUsed);
      const newCharitySplitterAddress = await charitySplitterFactory.charitySplitters(accounts[4]);
      assert.notEqual(newCharitySplitterAddress, "0x0000000000000000000000000000000000000000");
    });

    it("records an error when empty owner passed to create a new splitter via the factory V1", async () => {
      const existingCharitySplitterAddress = await charitySplitterFactory.charitySplitters(accounts[4]);
      assert.equal(existingCharitySplitterAddress, "0x0000000000000000000000000000000000000000");

      // Check the error count has increased by 1
      const errorCountBefore = await charitySplitterFactory.errorCount();
      await charitySplitterFactory.createCharitySplitter("0x0000000000000000000000000000000000000000",{ from: accounts[4] });
      const errorCountAfter = await charitySplitterFactory.errorCount();
      assert.equal(errorCountAfter.toNumber(), errorCountBefore.addn(1).toNumber());

      // Check the new Charity was added with the sender as owner, instead of the empty account passed in
      const newCharitySplitterAddress = await charitySplitterFactory.charitySplitters(accounts[4]);
      assert.notEqual(newCharitySplitterAddress, "0x0000000000000000000000000000000000000000");
    });

    it("cannot create more than one splitter per user via the factory V1", async () => {
      await charitySplitterFactory.createCharitySplitter(accounts[5], { from: accounts[4] });
      await assertRevert(charitySplitterFactory.createCharitySplitter(accounts[5], { from: accounts[4] }), "owner-has-existing-charity-splitter");
    });

    it("can create a new splitter via the factory V2", async () => {
      const existingCharitySplitterAddress = await charitySplitterFactoryV2.charitySplitters(accounts[4]);
      assert.equal(existingCharitySplitterAddress, "0x0000000000000000000000000000000000000000");

      const tx = await charitySplitterFactoryV2.createCharitySplitter(charitySplitter.address, { from: accounts[4] });
      console.log("charitySplitterFactoryV2.createCharitySplitter cost", tx.receipt.gasUsed);
      const newCharitySplitterAddress = await charitySplitterFactoryV2.charitySplitters(accounts[4]);
      assert.notEqual(newCharitySplitterAddress, "0x0000000000000000000000000000000000000000");
    });
  });
});