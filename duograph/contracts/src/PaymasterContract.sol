// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPaymaster.sol";

/**
 * @title PaymasterContract
 * @author DuoGraph Team
 * @notice ERC-4337 Paymaster for sponsoring gas fees on pact operations
 * @dev Verifies users are part of valid pacts before sponsoring transactions
 */
contract PaymasterContract is IPaymaster {
    // ============ Errors ============
    
    error Unauthorized();
    error InsufficientDeposit();
    error UserNotInPact();
    error InvalidUserOperation();
    error WithdrawalFailed();
    
    // ============ Events ============
    
    event Deposited(address indexed depositor, uint256 amount);
    event Withdrawn(address indexed recipient, uint256 amount);
    event GasSponsored(address indexed user, uint256 amount, uint256 pactId);
    event PactFactoryUpdated(address indexed oldFactory, address indexed newFactory);
    
    // ============ State Variables ============
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice PactFactory contract address
    address public pactFactory;
    
    /// @notice EntryPoint contract (ERC-4337)
    address public immutable entryPoint;
    
    /// @notice Total sponsored gas amount
    uint256 public totalSponsored;
    
    /// @notice Gas sponsored per user
    mapping(address => uint256) public userSponsored;
    
    /// @notice Whitelist of approved senders
    mapping(address => bool) public approvedSenders;
    
    /// @notice Daily limit per user (in wei)
    uint256 public userDailyLimit;
    
    /// @notice Daily usage tracking
    mapping(address => mapping(uint256 => uint256)) public dailyUsage;
    
    // ============ Constructor ============
    
    constructor(address _entryPoint, address _pactFactory) {
        owner = msg.sender;
        entryPoint = _entryPoint;
        pactFactory = _pactFactory;
        userDailyLimit = 0.01 ether; // Default 0.01 ETH per day
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert Unauthorized();
        _;
    }
    
    // ============ ERC-4337 Paymaster Interface ============
    
    /**
     * @notice Validate a UserOperation for gas sponsorship
     * @dev Called by EntryPoint to check if we'll pay for this operation
     * @param userOp The user operation to validate
     * @param userOpHash Hash of the user operation
     * @param maxCost Maximum cost we'd pay
     * @return context Context for postOp
     * @return validationData Validation result (0 = valid)
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        // Check we have enough deposit
        if (address(this).balance < maxCost) revert InsufficientDeposit();
        
        // Extract sender
        address sender = userOp.sender;
        
        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        if (dailyUsage[sender][today] + maxCost > userDailyLimit) {
            return ("", 1); // Validation failed
        }
        
        // Verify sender is in an active pact
        if (!_isUserInActivePact(sender)) {
            return ("", 1); // Validation failed
        }
        
        // Prepare context for postOp
        context = abi.encode(sender, maxCost);
        validationData = 0; // Valid
    }
    
    /**
     * @notice Post-operation handler
     * @dev Called after the operation executes
     * @param mode Post-op mode
     * @param context Context from validatePaymasterUserOp
     * @param actualGasCost Actual gas used
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override onlyEntryPoint {
        (address sender, ) = abi.decode(context, (address, uint256));
        
        if (mode != PostOpMode.postOpReverted) {
            // Update tracking
            uint256 today = block.timestamp / 1 days;
            dailyUsage[sender][today] += actualGasCost;
            userSponsored[sender] += actualGasCost;
            totalSponsored += actualGasCost;
            
            emit GasSponsored(sender, actualGasCost, 0);
        }
    }
    
    // ============ Deposit/Withdraw ============
    
    /**
     * @notice Deposit ETH to sponsor gas
     */
    function deposit() external payable {
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw ETH from paymaster
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdraw(uint256 amount, address payable recipient) external onlyOwner {
        if (amount > address(this).balance) revert InsufficientDeposit();
        
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        
        emit Withdrawn(recipient, amount);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update the PactFactory address
     * @param newFactory New factory address
     */
    function setPactFactory(address newFactory) external onlyOwner {
        emit PactFactoryUpdated(pactFactory, newFactory);
        pactFactory = newFactory;
    }
    
    /**
     * @notice Update daily limit per user
     * @param newLimit New limit in wei
     */
    function setUserDailyLimit(uint256 newLimit) external onlyOwner {
        userDailyLimit = newLimit;
    }
    
    /**
     * @notice Add approved sender
     * @param sender Address to approve
     */
    function addApprovedSender(address sender) external onlyOwner {
        approvedSenders[sender] = true;
    }
    
    /**
     * @notice Remove approved sender
     * @param sender Address to remove
     */
    function removeApprovedSender(address sender) external onlyOwner {
        approvedSenders[sender] = false;
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get paymaster balance
     * @return Current ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Get remaining daily allowance for user
     * @param user User address
     * @return remaining Remaining allowance
     */
    function getRemainingDailyAllowance(address user) external view returns (uint256 remaining) {
        uint256 today = block.timestamp / 1 days;
        uint256 used = dailyUsage[user][today];
        if (used >= userDailyLimit) return 0;
        return userDailyLimit - used;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Check if user is in an active pact
     * @param user User address to check
     * @return True if user has active pact
     */
    function _isUserInActivePact(address user) internal view returns (bool) {
        // If approved sender, allow
        if (approvedSenders[user]) return true;
        
        // Query PactFactory
        try IPactFactoryView(pactFactory).getUserPacts(user) returns (uint256[] memory pactIds) {
            return pactIds.length > 0;
        } catch {
            return false;
        }
    }
    
    // ============ Receive ============
    
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}

/// @notice Interface for querying PactFactory
interface IPactFactoryView {
    function getUserPacts(address user) external view returns (uint256[] memory);
}
