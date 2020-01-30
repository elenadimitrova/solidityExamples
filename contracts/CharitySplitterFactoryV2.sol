/*
  Write a CharitySplitterFactoryV2 (and additional contracts if needed) that improves
  CharitySplitterFactory by minimizing the gas spent for each new deployment of a
  CharitySplitter.
*/

pragma solidity ^0.6.1;

import "./DelegateProxy.sol";

contract CharitySplitterFactoryV2 {
  mapping (address => address) public charitySplitters;

  function createCharitySplitter(address implementation) public {
    require(address(charitySplitters[msg.sender]) == address(0), "owner-has-existing-charity-splitter");
    DelegateProxy newCharitySplitter = new DelegateProxy(implementation);
    charitySplitters[msg.sender] = address(newCharitySplitter);
  }
}