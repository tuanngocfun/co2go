// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CO2GoToken
 * @dev ERC20 token for CO2Go Reward System
 * Users will receive these tokens as rewards for eco-friendly trips
 * Token can be viewed in MetaMask and transferred
 */
contract CO2GoToken is ERC20, Ownable {
    // Decimals for the token (18 is standard for ERC20)
    uint8 private constant _decimals = 18;
    
    // Minter role (RewardSystem contract will be the minter)
    mapping(address => bool) public minters;
    
    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    constructor() ERC20("CO2Go Points", "C2GP") Ownable(msg.sender) {
        // Owner is automatically a minter
        minters[msg.sender] = true;
        emit MinterAdded(msg.sender);
        
        // Mint initial supply to owner for testing (1 million tokens)
        _mint(msg.sender, 1_000_000 * 10**_decimals);
    }
    
    /**
     * @dev Add a new minter (typically the RewardSystem contract)
     */
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter address");
        require(!minters[_minter], "Already a minter");
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }
    
    /**
     * @dev Remove a minter
     */
    function removeMinter(address _minter) external onlyOwner {
        require(minters[_minter], "Not a minter");
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }
    
    /**
     * @dev Mint tokens (only minters can call)
     */
    function mint(address _to, uint256 _amount) external {
        require(minters[msg.sender], "Only minters can mint");
        require(_to != address(0), "Cannot mint to zero address");
        _mint(_to, _amount);
        emit TokensMinted(_to, _amount);
    }
    
    /**
     * @dev Burn tokens from an address (for reward redemption)
     */
    function burn(address _from, uint256 _amount) external {
        require(minters[msg.sender], "Only minters can burn");
        require(_from != address(0), "Cannot burn from zero address");
        _burn(_from, _amount);
        emit TokensBurned(_from, _amount);
    }
    
    /**
     * @dev Get token decimals
     */
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Check if an address is a minter
     */
    function isMinter(address _address) external view returns (bool) {
        return minters[_address];
    }
}
