// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAccount.sol";

/**
 * @title DuoGraphAccount
 * @author DuoGraph Team
 * @notice ERC-4337 Smart Account for DuoGraph users
 * @dev Supports hardware-bound identity verification and gasless transactions
 */
contract DuoGraphAccount is IAccount {
    // ============ Errors ============
    
    error Unauthorized();
    error InvalidSignature();
    error InvalidNonce();
    error ExecutionFailed();
    error AlreadyInitialized();
    
    // ============ Events ============
    
    event AccountInitialized(address indexed owner, bytes publicKey);
    event PublicKeyUpdated(bytes oldKey, bytes newKey);
    event Executed(address indexed target, uint256 value, bytes data);
    event ExecutedBatch(address[] targets, uint256[] values, bytes[] datas);
    
    // ============ State Variables ============
    
    /// @notice Account owner
    address public owner;
    
    /// @notice EntryPoint contract
    address public immutable entryPoint;
    
    /// @notice Whether account is initialized
    bool public initialized;
    
    /// @notice ECDH public key for encryption
    bytes public publicKey;
    
    /// @notice Key fingerprint for identity verification
    bytes32 public keyFingerprint;
    
    /// @notice Nonce for replay protection
    uint256 public nonce;
    
    /// @notice EIP-712 domain separator
    bytes32 public DOMAIN_SEPARATOR;
    
    /// @notice Typehash for execution
    bytes32 public constant EXECUTE_TYPEHASH = 
        keccak256("Execute(address target,uint256 value,bytes data,uint256 nonce)");
    
    // ============ Constructor ============
    
    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }
    
    // ============ Initialization ============
    
    /**
     * @notice Initialize the account with owner and public key
     * @param _owner Account owner address
     * @param _publicKey ECDH public key for encryption
     */
    function initialize(address _owner, bytes calldata _publicKey) external {
        if (initialized) revert AlreadyInitialized();
        
        owner = _owner;
        publicKey = _publicKey;
        keyFingerprint = keccak256(_publicKey);
        initialized = true;
        
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("DuoGraphAccount"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
        
        emit AccountInitialized(_owner, _publicKey);
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
    
    modifier onlyOwnerOrEntryPoint() {
        if (msg.sender != owner && msg.sender != entryPoint) revert Unauthorized();
        _;
    }
    
    // ============ ERC-4337 Account Interface ============
    
    /**
     * @notice Validate a UserOperation
     * @param userOp The user operation
     * @param userOpHash Hash of the operation
     * @param missingAccountFunds Funds to prefund
     * @return validationData 0 if valid, 1 if invalid
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        // Verify signature
        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, userOpHash)
        );
        
        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(userOp.signature);
        address signer = ecrecover(hash, v, r, s);
        
        if (signer != owner) {
            return 1; // Invalid
        }
        
        // Pay prefund if needed
        if (missingAccountFunds > 0) {
            (bool success, ) = payable(entryPoint).call{value: missingAccountFunds}("");
            require(success, "Prefund failed");
        }
        
        return 0; // Valid
    }
    
    // ============ Execution ============
    
    /**
     * @notice Execute a single transaction
     * @param target Target address
     * @param value ETH value
     * @param data Call data
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwnerOrEntryPoint returns (bytes memory result) {
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
        
        emit Executed(target, value, data);
        return returnData;
    }
    
    /**
     * @notice Execute a batch of transactions
     * @param targets Target addresses
     * @param values ETH values
     * @param datas Call data array
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyOwnerOrEntryPoint {
        require(
            targets.length == values.length && values.length == datas.length,
            "Length mismatch"
        );
        
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory returnData) = targets[i].call{value: values[i]}(datas[i]);
            if (!success) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
        }
        
        emit ExecutedBatch(targets, values, datas);
    }
    
    // ============ Public Key Management ============
    
    /**
     * @notice Update the public key for encryption
     * @param newPublicKey New ECDH public key
     */
    function updatePublicKey(bytes calldata newPublicKey) external onlyOwner {
        bytes memory oldKey = publicKey;
        publicKey = newPublicKey;
        keyFingerprint = keccak256(newPublicKey);
        
        emit PublicKeyUpdated(oldKey, newPublicKey);
    }
    
    /**
     * @notice Verify a key fingerprint matches
     * @param fingerprint Fingerprint to verify
     * @return matches Whether it matches
     */
    function verifyFingerprint(bytes32 fingerprint) external view returns (bool matches) {
        return fingerprint == keyFingerprint;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get account info
     * @return _owner Owner address
     * @return _publicKey Public key
     * @return _fingerprint Key fingerprint
     */
    function getAccountInfo() external view returns (
        address _owner,
        bytes memory _publicKey,
        bytes32 _fingerprint
    ) {
        return (owner, publicKey, keyFingerprint);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Split signature into v, r, s components
     * @param signature The signature bytes
     */
    function _splitSignature(bytes memory signature) internal pure returns (
        uint8 v,
        bytes32 r,
        bytes32 s
    ) {
        require(signature.length == 65, "Invalid signature length");
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) v += 27;
    }
    
    // ============ Receive ============
    
    receive() external payable {}
}

/// @notice Simple factory for deploying accounts
contract DuoGraphAccountFactory {
    event AccountCreated(address indexed account, address indexed owner);
    
    address public immutable entryPoint;
    address public immutable accountImplementation;
    
    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
        accountImplementation = address(new DuoGraphAccount(_entryPoint));
    }
    
    /**
     * @notice Create a new account
     * @param owner Owner address
     * @param publicKey ECDH public key
     * @param salt Deployment salt
     * @return account The deployed account address
     */
    function createAccount(
        address owner,
        bytes calldata publicKey,
        bytes32 salt
    ) external returns (address account) {
        bytes32 actualSalt = keccak256(abi.encodePacked(owner, salt));
        
        // Deploy minimal proxy
        account = _deployProxy(actualSalt);
        
        // Initialize
        DuoGraphAccount(payable(account)).initialize(owner, publicKey);
        
        emit AccountCreated(account, owner);
    }
    
    /**
     * @notice Compute account address before deployment
     * @param owner Owner address
     * @param salt Deployment salt
     * @return The computed address
     */
    function getAddress(address owner, bytes32 salt) external view returns (address) {
        bytes32 actualSalt = keccak256(abi.encodePacked(owner, salt));
        return _computeAddress(actualSalt);
    }
    
    function _deployProxy(bytes32 salt) internal returns (address proxy) {
        bytes memory bytecode = _getProxyBytecode();
        assembly {
            proxy := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(proxy != address(0), "Deployment failed");
    }
    
    function _computeAddress(bytes32 salt) internal view returns (address) {
        bytes memory bytecode = _getProxyBytecode();
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }
    
    function _getProxyBytecode() internal view returns (bytes memory) {
        // Minimal proxy bytecode pointing to implementation
        return abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            accountImplementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
    }
}
