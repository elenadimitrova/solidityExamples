/*
  Note that no auth is implemented here for brevity
*/

pragma solidity ^0.6.1;


contract DelegateProxy {
  address public implementation;
  constructor (address _implementation) public {
    implementation = _implementation;
  }

  fallback() external payable {
    address destination = implementation;
    assembly {
      calldatacopy(mload(0x40), 0, calldatasize())
      let result := delegatecall(gas(), destination, mload(0x40), calldatasize(), mload(0x40), 0)
      returndatacopy(mload(0x40), 0, returndatasize())
      switch result
      case 1 { return(mload(0x40), returndatasize()) }
      default { revert(mload(0x40), returndatasize()) }
    }
  }
}
