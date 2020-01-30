pragma solidity ^0.6.1;


interface ERC677Receiver {
  function onTokenTransfer(address _sender, uint _value, bytes calldata _data) external;
}