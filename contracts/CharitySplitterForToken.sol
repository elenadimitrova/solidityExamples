/*
  Write a CharitySplitterForToken contract that extends the CharitySplitter contract but
  can also receive and distribute ERC-677 tokens.
*/

pragma solidity ^0.6.1;

import "./CharitySplitter.sol";
import "./ERC677Token.sol";
import "./ERC677Receiver.sol";

contract CharitySplitterForToken is CharitySplitter, ERC677Receiver {
  constructor(address _owner) CharitySplitter(_owner) public {}

  function onTokenTransfer(address _sender, uint256 _value, bytes calldata _data) override external {
    require(activeCharitiesCount > 0, "no-charities-to-distribute-value-to");
    uint256 singleCharityShare = _value / activeCharitiesCount;
    require(singleCharityShare > 0, "donation-too-low-to-distribute");

    ERC677Token token = ERC677Token(msg.sender);

    for (uint i = 1; i <= totalCharitiesCount; i += 1) {
      address payable charityAddress;
      bool enabled;
      Charity storage charity = charities[i];
      if (charity.enabled) {
        token.transfer(charity.charityAddress, singleCharityShare);
      }
    }
  }
}