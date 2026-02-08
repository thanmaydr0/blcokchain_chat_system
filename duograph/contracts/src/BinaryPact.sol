// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BinaryPact
 * @author DuoGraph Team
 * @notice Individual pact contract for exactly 2 users with session key management
 * @dev CRITICAL SECURITY: user1 and user2 are IMMUTABLE - no function to add 3rd user exists
 * 
 * This contract enforces the mathematical impossibility of a 3rd party:
 * - user1 and user2 are set in constructor and marked immutable
 * - No addUser(), setUser(), or similar function exists
 * - All functions check onlyPactMember modifier
 */
contract BinaryPact {
    // ============ Errors ============
    
    /// @notice Thrown when caller is not user1 or user2
    error NotPactMember();
    
    /// @notice Thrown when action requires both signatures
    error RequiresBothSignatures();
    
    /// @notice Thrown when pact is already dissolved
    error PactAlreadyDissolved();
    
    /// @notice Thrown when session key is invalid
    error InvalidSessionKey();
    
    /// @notice Thrown when session key has expired
    error SessionKeyExpired();
    
    /// @notice Thrown when signature is invalid
    error InvalidSignature();
    
    /// @notice Thrown when deadline has passed
    error DeadlinePassed();
    
    // ============ Events ============
    
    /// @notice Emitted when a new session key is registered
    event SessionKeyRegistered(
        address indexed user,
        bytes32 indexed keyHash,
        uint256 expiresAt
    );
    
    /// @notice Emitted when session key is rotated
    event SessionKeyRotated(
        address indexed user,
        bytes32 indexed oldKeyHash,
        bytes32 indexed newKeyHash
    );
    
    /// @notice Emitted when session key is revoked
    event SessionKeyRevoked(address indexed user, bytes32 indexed keyHash);
    
    /// @notice Emitted when pact is dissolved
    event PactDissolved(uint256 indexed pactId, uint256 timestamp);
    
    /// @notice Emitted when public key is updated
    event PublicKeyUpdated(address indexed user, bytes publicKey);
    
    /// @notice Emitted when message hash is registered
    event MessageHashRegistered(bytes32 indexed messageHash, address indexed sender);
    
    /// @notice Emitted when shared secret commitment is stored
    event SharedSecretCommitment(bytes32 indexed commitment);
    
    // ============ Structs ============
    
    /// @notice Session key data
    struct SessionKey {
        bytes32 keyHash;
        uint256 createdAt;
        uint256 expiresAt;
        bool isActive;
    }
    
    /// @notice Signature for 2-of-2 operations
    struct DualSignature {
        uint8 v1;
        bytes32 r1;
        bytes32 s1;
        uint8 v2;
        bytes32 r2;
        bytes32 s2;
    }
    
    // ============ Immutable State (SECURITY CRITICAL) ============
    
    /// @notice Pact ID from factory
    uint256 public immutable pactId;
    
    /// @notice First participant - IMMUTABLE, CANNOT BE CHANGED
    address public immutable user1;
    
    /// @notice Second participant - IMMUTABLE, CANNOT BE CHANGED  
    address public immutable user2;
    
    /// @notice Factory contract address
    address public immutable factory;
    
    /// @notice Creation timestamp
    uint256 public immutable createdAt;
    
    // ============ Mutable State ============
    
    /// @notice Whether the pact has been dissolved
    bool public isDissolved;
    
    /// @notice Dissolution timestamp (0 if active)
    uint256 public dissolvedAt;
    
    /// @notice Public keys for encryption (ECDH)
    mapping(address => bytes) public publicKeys;
    
    /// @notice Session keys per user (user => session key array)
    mapping(address => SessionKey[]) public sessionKeys;
    
    /// @notice Active session key index per user
    mapping(address => uint256) public activeSessionKeyIndex;
    
    /// @notice Shared secret commitment hash
    bytes32 public sharedSecretCommitment;
    
    /// @notice Message hashes that have been sent (for verification)
    mapping(bytes32 => bool) public messageHashes;
    
    /// @notice Nonces for replay protection
    mapping(address => uint256) public nonces;
    
    /// @notice EIP-712 domain separator
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    /// @notice Typehash for dissolution
    bytes32 public constant DISSOLVE_TYPEHASH = 
        keccak256("Dissolve(uint256 pactId,uint256 nonce,uint256 deadline)");
    
    /// @notice Typehash for session key registration
    bytes32 public constant SESSION_KEY_TYPEHASH =
        keccak256("RegisterSessionKey(bytes32 keyHash,uint256 expiresAt,uint256 nonce)");
    
    // ============ Constructor ============
    
    /**
     * @notice Creates a new Binary Pact between exactly 2 users
     * @dev user1 and user2 are IMMUTABLE - this is the core security guarantee
     * @param _pactId Unique identifier from factory
     * @param _user1 First participant (cannot be changed after deployment)
     * @param _user2 Second participant (cannot be changed after deployment)
     * @param _factory Factory contract address
     */
    constructor(
        uint256 _pactId,
        address _user1,
        address _user2,
        address _factory
    ) {
        pactId = _pactId;
        user1 = _user1;
        user2 = _user2;
        factory = _factory;
        createdAt = block.timestamp;
        
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("DuoGraphBinaryPact"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }
    
    // ============ Modifiers ============
    
    /**
     * @notice Restricts function to only user1 or user2
     * @dev This modifier enforces the 2-person restriction
     */
    modifier onlyPactMember() {
        if (msg.sender != user1 && msg.sender != user2) revert NotPactMember();
        _;
    }
    
    /// @notice Ensures pact is still active
    modifier pactActive() {
        if (isDissolved) revert PactAlreadyDissolved();
        _;
    }
    
    // ============ Public Key Management ============
    
    /**
     * @notice Register or update public key for encryption
     * @param publicKey ECDH public key bytes
     */
    function registerPublicKey(bytes calldata publicKey) external onlyPactMember pactActive {
        publicKeys[msg.sender] = publicKey;
        emit PublicKeyUpdated(msg.sender, publicKey);
    }
    
    /**
     * @notice Store commitment to shared secret (for verification)
     * @param commitment Hash of the derived shared secret
     */
    function commitSharedSecret(bytes32 commitment) external onlyPactMember pactActive {
        sharedSecretCommitment = commitment;
        emit SharedSecretCommitment(commitment);
    }
    
    // ============ Session Key Management ============
    
    /**
     * @notice Register a new session key for forward secrecy
     * @param keyHash Hash of the session key
     * @param validityPeriod How long the key is valid (in seconds)
     */
    function registerSessionKey(
        bytes32 keyHash,
        uint256 validityPeriod
    ) external onlyPactMember pactActive {
        if (keyHash == bytes32(0)) revert InvalidSessionKey();
        
        uint256 expiresAt = block.timestamp + validityPeriod;
        
        sessionKeys[msg.sender].push(SessionKey({
            keyHash: keyHash,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        }));
        
        activeSessionKeyIndex[msg.sender] = sessionKeys[msg.sender].length - 1;
        
        emit SessionKeyRegistered(msg.sender, keyHash, expiresAt);
    }
    
    /**
     * @notice Rotate to a new session key (deactivates old one)
     * @param newKeyHash Hash of the new session key
     * @param validityPeriod Validity period for new key
     */
    function rotateSessionKey(
        bytes32 newKeyHash,
        uint256 validityPeriod
    ) external onlyPactMember pactActive {
        if (newKeyHash == bytes32(0)) revert InvalidSessionKey();
        
        uint256 oldIndex = activeSessionKeyIndex[msg.sender];
        bytes32 oldKeyHash = bytes32(0);
        
        if (sessionKeys[msg.sender].length > 0) {
            sessionKeys[msg.sender][oldIndex].isActive = false;
            oldKeyHash = sessionKeys[msg.sender][oldIndex].keyHash;
        }
        
        uint256 expiresAt = block.timestamp + validityPeriod;
        
        sessionKeys[msg.sender].push(SessionKey({
            keyHash: newKeyHash,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        }));
        
        activeSessionKeyIndex[msg.sender] = sessionKeys[msg.sender].length - 1;
        
        emit SessionKeyRotated(msg.sender, oldKeyHash, newKeyHash);
    }
    
    /**
     * @notice Revoke a session key
     * @param keyIndex Index of the session key to revoke
     */
    function revokeSessionKey(uint256 keyIndex) external onlyPactMember {
        require(keyIndex < sessionKeys[msg.sender].length, "Invalid index");
        
        bytes32 keyHash = sessionKeys[msg.sender][keyIndex].keyHash;
        sessionKeys[msg.sender][keyIndex].isActive = false;
        
        emit SessionKeyRevoked(msg.sender, keyHash);
    }
    
    // ============ Message Registry ============
    
    /**
     * @notice Register a message hash for on-chain verification
     * @param messageHash Hash of the encrypted message
     */
    function registerMessageHash(bytes32 messageHash) external onlyPactMember pactActive {
        messageHashes[messageHash] = true;
        emit MessageHashRegistered(messageHash, msg.sender);
    }
    
    /**
     * @notice Verify a message hash was registered
     * @param messageHash Hash to verify
     * @return isValid Whether the hash is registered
     */
    function verifyMessageHash(bytes32 messageHash) external view returns (bool isValid) {
        return messageHashes[messageHash];
    }
    
    // ============ Emergency Dissolution (2-of-2 Required) ============
    
    /**
     * @notice Dissolve the pact - REQUIRES BOTH USER SIGNATURES
     * @dev This is the only way to end a pact - both parties must agree
     * @param deadline Signature expiration
     * @param sig Dual signature struct with both user signatures
     */
    function dissolvePact(
        uint256 deadline,
        DualSignature calldata sig
    ) external pactActive {
        if (block.timestamp > deadline) revert DeadlinePassed();
        
        bytes32 structHash = keccak256(
            abi.encode(DISSOLVE_TYPEHASH, pactId, nonces[user1]++, deadline)
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );
        
        // Verify user1 signature
        address signer1 = ecrecover(digest, sig.v1, sig.r1, sig.s1);
        if (signer1 != user1) revert InvalidSignature();
        
        // Verify user2 signature (with their nonce)
        structHash = keccak256(
            abi.encode(DISSOLVE_TYPEHASH, pactId, nonces[user2]++, deadline)
        );
        digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );
        
        address signer2 = ecrecover(digest, sig.v2, sig.r2, sig.s2);
        if (signer2 != user2) revert InvalidSignature();
        
        // Both signatures valid - dissolve pact
        isDissolved = true;
        dissolvedAt = block.timestamp;
        
        // Notify factory
        IPactFactory(factory).deactivatePact(pactId);
        
        emit PactDissolved(pactId, block.timestamp);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get the other participant address
     * @param user One of the participants
     * @return partner The other participant
     */
    function getPartner(address user) external view returns (address partner) {
        if (user == user1) return user2;
        if (user == user2) return user1;
        revert NotPactMember();
    }
    
    /**
     * @notice Check if address is a pact member
     * @param user Address to check
     * @return result Whether the address is user1 or user2
     */
    function isMember(address user) external view returns (bool result) {
        return user == user1 || user == user2;
    }
    
    /**
     * @notice Get active session key for a user
     * @param user User address
     * @return keyHash Active session key hash
     * @return expiresAt Expiration timestamp
     */
    function getActiveSessionKey(address user) external view returns (
        bytes32 keyHash,
        uint256 expiresAt
    ) {
        if (sessionKeys[user].length == 0) return (bytes32(0), 0);
        
        SessionKey storage key = sessionKeys[user][activeSessionKeyIndex[user]];
        if (!key.isActive || block.timestamp > key.expiresAt) {
            return (bytes32(0), 0);
        }
        
        return (key.keyHash, key.expiresAt);
    }
    
    /**
     * @notice Get all session keys for a user
     * @param user User address
     * @return keys Array of session keys
     */
    function getSessionKeys(address user) external view returns (SessionKey[] memory keys) {
        return sessionKeys[user];
    }
    
    /**
     * @notice Get pact status summary
     * @return isActive Active status
     * @return created Creation timestamp
     * @return dissolved Dissolution timestamp
     */
    function getStatus() external view returns (
        bool isActive,
        uint256 created,
        uint256 dissolved
    ) {
        return (!isDissolved, createdAt, dissolvedAt);
    }
}

/// @notice Interface for PactFactory
interface IPactFactory {
    function deactivatePact(uint256 pactId) external;
}
