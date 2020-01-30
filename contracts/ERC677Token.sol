pragma solidity ^0.6.1;

import "./ERC677Receiver.sol";


contract ERC677Token {
  uint256 public totalSupply;

  mapping(address => uint256) public balances;

  constructor () public {
    totalSupply = 100;
    balances[msg.sender] = 100;
  }

  function transfer(address _to, uint256 _value) public returns (bool) {
    balances[msg.sender] = balances[msg.sender] - _value;
    balances[_to] = balances[_to] + _value;
    emit Transfer(msg.sender, _to, _value);
    return true;
  }

  event Transfer(address indexed from, address indexed to, uint256 value);
  
  function transferAndCall(address _to, uint256 _value, bytes memory _data)
    public
    returns (bool success)
  {
    transfer(_to, _value);
    emit Transfer(msg.sender, _to, _value, _data);
    if (isContract(_to)) {
      contractFallback(_to, _value, _data);
    }
    return true;
  }

  event Transfer(address indexed from, address indexed to, uint value, bytes data);
  
  function contractFallback(address _to, uint _value, bytes memory _data)
    private
  {
    ERC677Receiver receiver = ERC677Receiver(_to);
    receiver.onTokenTransfer(msg.sender, _value, _data);
  }

  function isContract(address _addr)
    private
    returns (bool hasCode)
  {
    uint length;
    assembly { length := extcodesize(_addr) }
    return length > 0;
  }

}
