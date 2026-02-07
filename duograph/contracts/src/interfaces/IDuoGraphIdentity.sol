// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDuoGraphIdentity
 * @notice Interface for DuoGraph identity management
 */
interface IDuoGraphIdentity {
    struct Identity {
        address owner;
        bytes publicKey;
        bytes32 keyFingerprint;
        uint256 createdAt;
        bool isActive;
    }
    
    event IdentityCreated(address indexed owner, bytes32 indexed fingerprint);
    event IdentityUpdated(address indexed owner, bytes32 indexed newFingerprint);
    event IdentityDeactivated(address indexed owner);
}
