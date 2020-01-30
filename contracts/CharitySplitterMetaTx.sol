/* 
  Write a CharitySplitterMetaTx contract that extends the CharitySplitter contract and
  allows the owner to add/remove charities via meta-transactions.
*/

pragma solidity ^0.6.1;

import "./CharitySplitter.sol";

contract CharitySplitterMetaTx is CharitySplitter {

  // Owner is the contract itself
  constructor() CharitySplitter(msg.sender) public {}

  uint256 public changeNonces;

  event MetaTxExecutedSuccessfully(uint256 _nonce, address _signer);

  // Note that the charity owner will become this contract, not the msg.sender
  function addCharityMeta(bytes calldata _data, uint8 _sigV, bytes32 _sigR, bytes32 _sigS) external {
    uint256 _value;
    bytes32 msgHash = keccak256(abi.encodePacked(address(this), address(this), _value, _data, changeNonces));
    bytes32 txHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
    address signer = ecrecover(txHash, _sigV, _sigR, _sigS);
    require(signer == owner, "owner-has-to-sign-meta-tx");
    require(executeCall(address(this), _data), "charities-splitter-meta-tx-execution-failed");
    emit MetaTxExecutedSuccessfully(changeNonces, signer);
    changeNonces++;
  }

  function executeCall(address to, bytes memory data) internal returns (bool success) {
    assembly {
      success := call(gas(), to, 0, add(data, 0x20), mload(data), 0, 0)
    }
  }
}