pragma solidity ^0.6.1;

import "./CharitySplitter.sol";

contract CharitySplitterFactory {
  mapping (address => CharitySplitter) public charitySplitters;
  uint public errorCount;
  event ErrorHandled(string reason);
  event ErrorNotHandled(bytes reason);

  function createCharitySplitter(address _charityOwner) public {
    require(address(charitySplitters[msg.sender]) == address(0), "owner-has-existing-charity-splitter");
    try new CharitySplitter(getCharityOwner(_charityOwner, false)) returns (CharitySplitter newCharitySplitter) {
      charitySplitters[msg.sender] = newCharitySplitter;
    }
    catch Error(string memory reason) {
      errorCount++;

      // Creating a new contract but passing a valid owner this time
      CharitySplitter newCharitySplitter = new CharitySplitter(msg.sender);
      charitySplitters[msg.sender] = newCharitySplitter;
      
      // Emiting the error as event
      emit ErrorHandled(reason);
    }
    catch (bytes memory reason) {
      errorCount++;
      emit ErrorNotHandled(reason);
    }
  }

  function getCharityOwner(address _charityOwner, bool _toPass) internal returns (address) {
    require(_toPass, "revert-required-for-testing");
    return _charityOwner;
  }
}