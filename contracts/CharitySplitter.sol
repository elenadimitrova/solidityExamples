/*
  Write the CharitySplitter contract. The contract must be owned by a single address that
  can add and remove charities dynamically. Upon receiving ETH the contract must split it
  equally and transfer the resulting amount to the charities.
*/

pragma solidity ^0.6.1;

contract CharitySplitter {

  address public owner;
  // Assume a 'charity' here is defined just by an address, however it can be extended iwith more props
  struct Charity {
    address payable charityAddress;
    bool enabled;
  }
  mapping (uint256 => Charity) public charities;
  // Maintain the total count of charities added, including those that are subsequently deleted.
  // This serves the indexing of the `charities` mapping
  uint256 public totalCharitiesCount;
  // Maintain the total count of active charities, this is the total minus those that have been removed
  // This serves to calculate the equally split share for each active charity
  uint256 public activeCharitiesCount;
  uint256 public nonDistributedDonationsTotal;

  constructor (address _owner) public {
    require(_owner != address(0), "no-owner-provided");
    owner = _owner;
  }

  modifier onlyOwner() {
    require(msg.sender == owner || msg.sender == address(this), "charity-splitter-access-denied");
    _;
  }

  function addCharity(address payable _charityAddress) external onlyOwner {
    totalCharitiesCount += 1;
    charities[totalCharitiesCount] = Charity({
      charityAddress: _charityAddress,
      enabled: true
    });
    activeCharitiesCount += 1;
  }

  function removeCharity(uint256 _charityIndex) external onlyOwner {
    require(_charityIndex > 0 && _charityIndex <= totalCharitiesCount && charities[_charityIndex].enabled, "charity-does-not-exist");
    
    Charity storage charityToDisable = charities[_charityIndex];
    charityToDisable.enabled = false;
    activeCharitiesCount -= 1;
  }

  receive() external payable {
    require(activeCharitiesCount > 0, "no-charities-to-distribute-value-to");
    // This rounds down in division so there's a good chance there'll be remainder left.
    // We're not doing anything with that for now but could either keep it, distribute to a random charity or return to sender.
    uint256 singleCharityShare = msg.value / activeCharitiesCount;
    require(singleCharityShare > 0, "donation-too-low-to-distribute");
    // I would not recomment doing a transfer here in general but would instead implement a withdrawal pattern.
    // Since the guidelines are asking explicitely for a transfer, I've used that.
    for (uint i = 1; i <= totalCharitiesCount; i += 1) {
      address payable charityAddress;
      bool enabled;
      Charity storage charity = charities[i];
      if (charity.enabled) {
        (bool success, ) = charity.charityAddress.call.value(singleCharityShare)("");
        if (!success) {
          nonDistributedDonationsTotal += singleCharityShare;
        }
      }
    }
  }
}