import { Interface, type InterfaceAbi, Contract } from 'ethers';

// Environment variables or defaults
const TO_ADDR = (envVar: string | undefined, def: string) => envVar || def;

export const CONTRACT_ADDRESSES = {
    PactFactory: TO_ADDR(import.meta.env.VITE_PACT_FACTORY_ADDRESS, '0x47cE94bB1bedd7953Fb3917f37A28A79521cbFEB'),
    DuoGraphAccountFactory: TO_ADDR(import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS, '0xb355C259cbAF5c49e2768F166b3b0aCA37188c70'),
    Paymaster: TO_ADDR(import.meta.env.VITE_PAYMASTER_ADDRESS, '0x2C8436727b1a1fC67A1b4d028cec6dffCCe1Ecb0'),
    EntryPoint: TO_ADDR(import.meta.env.VITE_ENTRYPOINT_ADDRESS, '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'),
};

export const PACT_FACTORY_ABI: InterfaceAbi = [
    "function createPact(address user1, address user2) external returns (uint256 pactId, address pactAddress)",
    "function createPactWithSignature(address user1, address user2, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 pactId, address pactAddress)",
    "function getPact(uint256 pactId) external view returns (tuple(uint256 pactId, address pactAddress, address user1, address user2, uint256 createdAt, bool isActive))",
    "function getUserPacts(address user) external view returns (uint256[])",
    "function checkPactExists(address user1, address user2) external view returns (bool hasPact, uint256 pactId)",
    "function pactAddressToId(address) external view returns (uint256)",
    "event PactCreated(uint256 indexed pactId, address indexed pactAddress, address indexed user1, address user2, uint256 timestamp)"
];

export const BINARY_PACT_ABI: InterfaceAbi = [
    "function registerSessionKey(bytes32 keyHash, uint256 validityPeriod) external",
    "function rotateSessionKey(bytes32 newKeyHash, uint256 validityPeriod) external",
    "function revokeSessionKey(uint256 keyIndex) external",
    "function getSessionKeys(address user) external view returns (tuple(bytes32 keyHash, uint256 createdAt, uint256 expiresAt, bool isActive)[])",
    "function getActiveSessionKey(address user) external view returns (bytes32 keyHash, uint256 expiresAt)",
    "function registerMessageHash(bytes32 messageHash) external",
    "function verifyMessageHash(bytes32 messageHash) external view returns (bool isValid)",
    "function dissolvePact(uint256 deadline, tuple(uint8 v1, bytes32 r1, bytes32 s1, uint8 v2, bytes32 r2, bytes32 s2) sig) external",
    "function isMember(address user) external view returns (bool result)",
    "function getStatus() external view returns (bool isActive, uint256 created, uint256 dissolved)",
    "event SessionKeyRegistered(address indexed user, bytes32 indexed keyHash, uint256 expiresAt)",
    "event SessionKeyRevoked(address indexed user, bytes32 indexed keyHash)",
    "event SessionKeyRotated(address indexed user, bytes32 indexed oldKeyHash, bytes32 indexed newKeyHash)",
    "event MessageHashRegistered(bytes32 indexed messageHash, address indexed sender)",
    "event PactDissolved(uint256 indexed pactId, uint256 timestamp)"
];

export const DUOGRAPH_ACCOUNT_ABI: InterfaceAbi = [
    "function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory)",
    "function executeBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata datas) external",
    "function initialize(address _owner, bytes calldata _publicKey) external",
    "function updatePublicKey(bytes calldata newPublicKey) external",
    "function getAccountInfo() external view returns (address _owner, bytes memory _publicKey, bytes32 _fingerprint)",
    "function nonce() external view returns (uint256)",
    "function entryPoint() external view returns (address)"
];

export const PAYMASTER_ABI: InterfaceAbi = [
    "function userDailyLimit() external view returns (uint256)",
    "function userSponsored(address) external view returns (uint256)",
    "function dailyUsage(address, uint256) external view returns (uint256)",
    "function getRemainingDailyAllowance(address user) external view returns (uint256)",
    "function setUserDailyLimit(uint256 newLimit) external"
];

export const DUOGRAPH_ACCOUNT_FACTORY_ABI: InterfaceAbi = [
    "function createAccount(address owner, bytes calldata publicKey, bytes32 salt) external returns (address account)",
    "function getAddress(address owner, bytes32 salt) external view returns (address)",
    "function accountImplementation() external view returns (address)",
    "event AccountCreated(address indexed account, address indexed owner)"
];

export const ENTRYPOINT_ABI: InterfaceAbi = [
    "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)",
    "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external"
];

// Helper to get typed interfaces
export const getPactFactoryInterface = () => new Interface(PACT_FACTORY_ABI);
export const getBinaryPactInterface = () => new Interface(BINARY_PACT_ABI);
export const getAccountInterface = () => new Interface(DUOGRAPH_ACCOUNT_ABI);
export const getAccountFactoryInterface = () => new Interface(DUOGRAPH_ACCOUNT_FACTORY_ABI);
export const getPaymasterInterface = () => new Interface(PAYMASTER_ABI);
export const getEntryPointInterface = () => new Interface(ENTRYPOINT_ABI);

export const getEntryPoint = (runner: Contract['runner']) => new Contract(CONTRACT_ADDRESSES.EntryPoint, getEntryPointInterface(), runner);
