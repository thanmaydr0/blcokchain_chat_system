// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BinaryPact
 * @notice A contract for creating two-person encrypted communication pacts
 * @dev Each pact can have exactly 2 participants, enforced on-chain
 */
contract BinaryPact {
    // ============ Errors ============
    error PactNotFound();
    error PactAlreadyFull();
    error PactAlreadyActive();
    error PactNotPending();
    error NotPactParticipant();
    error CannotInviteSelf();
    error AlreadyHasPact();
    
    // ============ Events ============
    event PactCreated(
        uint256 indexed pactId,
        address indexed initiator,
        address indexed invitee,
        bytes32 encryptedMetadata
    );
    
    event PactAccepted(
        uint256 indexed pactId,
        address indexed acceptor,
        uint256 timestamp
    );
    
    event PactDissolved(
        uint256 indexed pactId,
        address indexed dissolver,
        uint256 timestamp
    );
    
    event PublicKeyRegistered(
        address indexed user,
        bytes publicKey
    );
    
    // ============ Enums ============
    enum PactStatus {
        NONE,
        PENDING,
        ACTIVE,
        DISSOLVED
    }
    
    // ============ Structs ============
    struct Pact {
        uint256 id;
        address initiator;
        address partner;
        PactStatus status;
        bytes32 encryptedMetadata; // IPFS hash of encrypted pact metadata
        uint256 createdAt;
        uint256 activatedAt;
        uint256 dissolvedAt;
    }
    
    // ============ State Variables ============
    uint256 private _pactIdCounter;
    
    // Mapping from pact ID to Pact
    mapping(uint256 => Pact) public pacts;
    
    // Mapping from user address to their active pact ID (0 if none)
    mapping(address => uint256) public userActivePact;
    
    // Mapping from user address to their public key (for encryption)
    mapping(address => bytes) public userPublicKeys;
    
    // ============ Constructor ============
    constructor() {
        _pactIdCounter = 1; // Start from 1, 0 means no pact
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Register or update your public key for encryption
     * @param publicKey The user's public key (ECDH P-256 format)
     */
    function registerPublicKey(bytes calldata publicKey) external {
        userPublicKeys[msg.sender] = publicKey;
        emit PublicKeyRegistered(msg.sender, publicKey);
    }
    
    /**
     * @notice Create a new pact and invite a partner
     * @param partner The address to invite
     * @param encryptedMetadata IPFS hash of encrypted pact metadata
     * @return pactId The ID of the created pact
     */
    function createPact(
        address partner,
        bytes32 encryptedMetadata
    ) external returns (uint256 pactId) {
        if (partner == msg.sender) revert CannotInviteSelf();
        if (userActivePact[msg.sender] != 0) revert AlreadyHasPact();
        if (userActivePact[partner] != 0) revert AlreadyHasPact();
        
        pactId = _pactIdCounter++;
        
        pacts[pactId] = Pact({
            id: pactId,
            initiator: msg.sender,
            partner: partner,
            status: PactStatus.PENDING,
            encryptedMetadata: encryptedMetadata,
            createdAt: block.timestamp,
            activatedAt: 0,
            dissolvedAt: 0
        });
        
        emit PactCreated(pactId, msg.sender, partner, encryptedMetadata);
    }
    
    /**
     * @notice Accept a pending pact invitation
     * @param pactId The ID of the pact to accept
     */
    function acceptPact(uint256 pactId) external {
        Pact storage pact = pacts[pactId];
        
        if (pact.id == 0) revert PactNotFound();
        if (pact.status != PactStatus.PENDING) revert PactNotPending();
        if (pact.partner != msg.sender) revert NotPactParticipant();
        if (userActivePact[msg.sender] != 0) revert AlreadyHasPact();
        
        pact.status = PactStatus.ACTIVE;
        pact.activatedAt = block.timestamp;
        
        // Set active pact for both users
        userActivePact[pact.initiator] = pactId;
        userActivePact[msg.sender] = pactId;
        
        emit PactAccepted(pactId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Dissolve an active pact (either participant can do this)
     * @param pactId The ID of the pact to dissolve
     */
    function dissolvePact(uint256 pactId) external {
        Pact storage pact = pacts[pactId];
        
        if (pact.id == 0) revert PactNotFound();
        if (pact.initiator != msg.sender && pact.partner != msg.sender) {
            revert NotPactParticipant();
        }
        
        // Clear active pact for both users
        if (pact.status == PactStatus.ACTIVE) {
            userActivePact[pact.initiator] = 0;
            userActivePact[pact.partner] = 0;
        }
        
        pact.status = PactStatus.DISSOLVED;
        pact.dissolvedAt = block.timestamp;
        
        emit PactDissolved(pactId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Cancel a pending pact (only initiator)
     * @param pactId The ID of the pact to cancel
     */
    function cancelPact(uint256 pactId) external {
        Pact storage pact = pacts[pactId];
        
        if (pact.id == 0) revert PactNotFound();
        if (pact.status != PactStatus.PENDING) revert PactNotPending();
        if (pact.initiator != msg.sender) revert NotPactParticipant();
        
        pact.status = PactStatus.DISSOLVED;
        pact.dissolvedAt = block.timestamp;
        
        emit PactDissolved(pactId, msg.sender, block.timestamp);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get pact details
     * @param pactId The ID of the pact
     * @return The pact struct
     */
    function getPact(uint256 pactId) external view returns (Pact memory) {
        return pacts[pactId];
    }
    
    /**
     * @notice Get user's active pact
     * @param user The user address
     * @return The active pact or empty if none
     */
    function getUserPact(address user) external view returns (Pact memory) {
        uint256 pactId = userActivePact[user];
        if (pactId == 0) {
            return Pact(0, address(0), address(0), PactStatus.NONE, bytes32(0), 0, 0, 0);
        }
        return pacts[pactId];
    }
    
    /**
     * @notice Get user's public key
     * @param user The user address
     * @return The public key bytes
     */
    function getPublicKey(address user) external view returns (bytes memory) {
        return userPublicKeys[user];
    }
    
    /**
     * @notice Check if two users can form a pact
     * @param user1 First user address
     * @param user2 Second user address
     * @return canForm Whether they can form a pact
     */
    function canFormPact(address user1, address user2) external view returns (bool canForm) {
        return user1 != user2 && 
               userActivePact[user1] == 0 && 
               userActivePact[user2] == 0;
    }
}
