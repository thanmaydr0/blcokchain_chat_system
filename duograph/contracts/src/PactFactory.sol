// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BinaryPact.sol";

/**
 * @title PactFactory
 * @author DuoGraph Team
 * @notice Factory contract for creating Binary Pacts between exactly 2 users
 * @dev Mathematical impossibility of 3rd party: No function exists to add users after creation
 * 
 * SECURITY INVARIANT: Each pact has exactly 2 immutable participants.
 * This is enforced by:
 * 1. Constructor sets user1 and user2 as immutable
 * 2. No function exists to modify participants
 * 3. BinaryPact contract has no addUser() function
 */
contract PactFactory {
    // ============ Errors ============
    
    /// @notice Thrown when user tries to create pact with themselves
    error CannotCreatePactWithSelf();
    
    /// @notice Thrown when either address is zero
    error ZeroAddressNotAllowed();
    
    /// @notice Thrown when users already have an active pact together
    error PactAlreadyExists();
    
    /// @notice Thrown when caller is not authorized
    error Unauthorized();
    
    // ============ Events ============
    
    /// @notice Emitted when a new Binary Pact is created
    /// @param pactId Unique identifier for the pact
    /// @param pactAddress Deployed address of the BinaryPact contract
    /// @param user1 First participant (initiator)
    /// @param user2 Second participant (invitee)
    /// @param timestamp Creation timestamp
    event PactCreated(
        uint256 indexed pactId,
        address indexed pactAddress,
        address indexed user1,
        address user2,
        uint256 timestamp
    );
    
    /// @notice Emitted when factory owner is changed
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // ============ Structs ============
    
    /// @notice Metadata for each pact
    struct PactMetadata {
        uint256 pactId;
        address pactAddress;
        address user1;
        address user2;
        uint256 createdAt;
        bool isActive;
    }
    
    // ============ State Variables ============
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Counter for pact IDs (starts at 1)
    uint256 private _pactIdCounter;
    
    /// @notice Mapping from pact ID to PactMetadata
    mapping(uint256 => PactMetadata) public pacts;
    
    /// @notice Mapping from pact address to pact ID
    mapping(address => uint256) public pactAddressToId;
    
    /// @notice Mapping from user address to array of their pact IDs
    mapping(address => uint256[]) public userPacts;
    
    /// @notice Mapping to check if two users have a pact (sorted addresses => pact ID)
    mapping(bytes32 => uint256) private _userPairToPact;
    
    /// @notice EIP-712 domain separator
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    /// @notice EIP-712 typehash for pact creation
    bytes32 public constant PACT_CREATION_TYPEHASH = 
        keccak256("CreatePact(address user1,address user2,uint256 nonce,uint256 deadline)");
    
    /// @notice Nonces for EIP-712 signatures
    mapping(address => uint256) public nonces;
    
    // ============ Constructor ============
    
    constructor() {
        owner = msg.sender;
        _pactIdCounter = 1;
        
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("DuoGraphPactFactory"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Create a new Binary Pact between exactly 2 users
     * @dev Deploys a new BinaryPact contract with immutable participants
     * @param user1 First participant address (typically msg.sender)
     * @param user2 Second participant address
     * @return pactId The unique identifier for the created pact
     * @return pactAddress The deployed BinaryPact contract address
     * 
     * SECURITY: This function ONLY creates 2-person pacts.
     * No function exists to add a 3rd user - this is the mathematical restriction.
     */
    function createPact(
        address user1,
        address user2
    ) external returns (uint256 pactId, address pactAddress) {
        // Validation
        if (user1 == address(0) || user2 == address(0)) revert ZeroAddressNotAllowed();
        if (user1 == user2) revert CannotCreatePactWithSelf();
        
        // Check if pact already exists between these users
        bytes32 pairHash = _getUserPairHash(user1, user2);
        if (_userPairToPact[pairHash] != 0) revert PactAlreadyExists();
        
        // Generate pact ID
        pactId = _pactIdCounter++;
        
        // Deploy new BinaryPact contract with IMMUTABLE users
        BinaryPact newPact = new BinaryPact(
            pactId,
            user1,
            user2,
            address(this)
        );
        pactAddress = address(newPact);
        
        // Store metadata
        pacts[pactId] = PactMetadata({
            pactId: pactId,
            pactAddress: pactAddress,
            user1: user1,
            user2: user2,
            createdAt: block.timestamp,
            isActive: true
        });
        
        pactAddressToId[pactAddress] = pactId;
        userPacts[user1].push(pactId);
        userPacts[user2].push(pactId);
        _userPairToPact[pairHash] = pactId;
        
        emit PactCreated(pactId, pactAddress, user1, user2, block.timestamp);
    }
    
    /**
     * @notice Create pact with EIP-712 signature (for gasless creation)
     * @param user1 First participant
     * @param user2 Second participant
     * @param deadline Signature expiration timestamp
     * @param v Signature v component
     * @param r Signature r component
     * @param s Signature s component
     */
    function createPactWithSignature(
        address user1,
        address user2,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 pactId, address pactAddress) {
        require(block.timestamp <= deadline, "Signature expired");
        
        bytes32 structHash = keccak256(
            abi.encode(
                PACT_CREATION_TYPEHASH,
                user1,
                user2,
                nonces[user1]++,
                deadline
            )
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );
        
        address signer = ecrecover(digest, v, r, s);
        require(signer == user1, "Invalid signature");
        
        return this.createPact(user1, user2);
    }
    
    /**
     * @notice Mark a pact as inactive (called by BinaryPact on dissolution)
     * @param pactId The pact ID to deactivate
     */
    function deactivatePact(uint256 pactId) external {
        require(msg.sender == pacts[pactId].pactAddress, "Only pact contract");
        pacts[pactId].isActive = false;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get pact metadata by ID
     * @param pactId The pact ID
     * @return PactMetadata struct
     */
    function getPact(uint256 pactId) external view returns (PactMetadata memory) {
        return pacts[pactId];
    }
    
    /**
     * @notice Get all pact IDs for a user
     * @param user The user address
     * @return Array of pact IDs
     */
    function getUserPacts(address user) external view returns (uint256[] memory) {
        return userPacts[user];
    }
    
    /**
     * @notice Check if two users have an active pact
     * @param user1 First user
     * @param user2 Second user
     * @return hasPact Whether they have a pact
     * @return pactId The pact ID (0 if none)
     */
    function checkPactExists(
        address user1,
        address user2
    ) external view returns (bool hasPact, uint256 pactId) {
        bytes32 pairHash = _getUserPairHash(user1, user2);
        pactId = _userPairToPact[pairHash];
        hasPact = pactId != 0 && pacts[pactId].isActive;
    }
    
    /**
     * @notice Get the total number of pacts created
     * @return Total pact count
     */
    function totalPacts() external view returns (uint256) {
        return _pactIdCounter - 1;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Generate consistent hash for user pair (order-independent)
     * @param user1 First address
     * @param user2 Second address
     * @return Hash of the sorted pair
     */
    function _getUserPairHash(address user1, address user2) internal pure returns (bytes32) {
        // Sort addresses to ensure consistent hash regardless of order
        if (user1 < user2) {
            return keccak256(abi.encodePacked(user1, user2));
        } else {
            return keccak256(abi.encodePacked(user2, user1));
        }
    }
}
