import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { PactFactory, BinaryPact } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Binary Pact Protocol", function () {
    // Fixture for consistent test setup
    async function deployFactoryFixture() {
        const [owner, user1, user2, user3] = await ethers.getSigners();

        const PactFactory = await ethers.getContractFactory("PactFactory");
        const factory = await PactFactory.deploy();

        return { factory, owner, user1, user2, user3 };
    }

    describe("PactFactory", function () {
        describe("Deployment", function () {
            it("Should set the correct owner", async function () {
                const { factory, owner } = await loadFixture(deployFactoryFixture);
                expect(await factory.owner()).to.equal(owner.address);
            });

            it("Should start with zero pacts", async function () {
                const { factory } = await loadFixture(deployFactoryFixture);
                expect(await factory.totalPacts()).to.equal(0);
            });
        });

        describe("Pact Creation", function () {
            it("Should create a pact between two users", async function () {
                const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);

                const tx = await factory.createPact(user1.address, user2.address);
                const receipt = await tx.wait();

                // Check event
                const event = receipt?.logs.find(
                    (log: any) => log.fragment?.name === "PactCreated"
                );
                expect(event).to.not.be.undefined;

                // Check pact count
                expect(await factory.totalPacts()).to.equal(1);
            });

            it("Should deploy a BinaryPact contract", async function () {
                const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);

                await factory.createPact(user1.address, user2.address);
                const pactData = await factory.getPact(1);

                expect(pactData.pactAddress).to.not.equal(ethers.ZeroAddress);
                expect(pactData.user1).to.equal(user1.address);
                expect(pactData.user2).to.equal(user2.address);
                expect(pactData.isActive).to.be.true;
            });

            it("Should NOT allow creating pact with self", async function () {
                const { factory, user1 } = await loadFixture(deployFactoryFixture);

                await expect(
                    factory.createPact(user1.address, user1.address)
                ).to.be.revertedWithCustomError(factory, "CannotCreatePactWithSelf");
            });

            it("Should NOT allow creating pact with zero address", async function () {
                const { factory, user1 } = await loadFixture(deployFactoryFixture);

                await expect(
                    factory.createPact(user1.address, ethers.ZeroAddress)
                ).to.be.revertedWithCustomError(factory, "ZeroAddressNotAllowed");
            });

            it("Should NOT allow duplicate pacts between same users", async function () {
                const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);

                await factory.createPact(user1.address, user2.address);

                // Try creating again (same order)
                await expect(
                    factory.createPact(user1.address, user2.address)
                ).to.be.revertedWithCustomError(factory, "PactAlreadyExists");

                // Try creating again (reverse order)
                await expect(
                    factory.createPact(user2.address, user1.address)
                ).to.be.revertedWithCustomError(factory, "PactAlreadyExists");
            });

            it("Should track user pacts correctly", async function () {
                const { factory, user1, user2, user3 } = await loadFixture(deployFactoryFixture);

                await factory.createPact(user1.address, user2.address);

                const user1Pacts = await factory.getUserPacts(user1.address);
                const user2Pacts = await factory.getUserPacts(user2.address);
                const user3Pacts = await factory.getUserPacts(user3.address);

                expect(user1Pacts.length).to.equal(1);
                expect(user2Pacts.length).to.equal(1);
                expect(user3Pacts.length).to.equal(0);
            });
        });

        describe("Pact Lookup", function () {
            it("Should correctly check if pact exists", async function () {
                const { factory, user1, user2, user3 } = await loadFixture(deployFactoryFixture);

                await factory.createPact(user1.address, user2.address);

                const [hasPact12, pactId12] = await factory.checkPactExists(user1.address, user2.address);
                const [hasPact13, pactId13] = await factory.checkPactExists(user1.address, user3.address);

                expect(hasPact12).to.be.true;
                expect(pactId12).to.equal(1);
                expect(hasPact13).to.be.false;
                expect(pactId13).to.equal(0);
            });
        });
    });

    describe("BinaryPact", function () {
        async function deployPactFixture() {
            const { factory, owner, user1, user2, user3 } = await loadFixture(deployFactoryFixture);

            await factory.createPact(user1.address, user2.address);
            const pactData = await factory.getPact(1);
            const pact = await ethers.getContractAt("BinaryPact", pactData.pactAddress);

            return { factory, pact, owner, user1, user2, user3 };
        }

        describe("Immutability (Security Critical)", function () {
            it("Should have immutable user1 and user2", async function () {
                const { pact, user1, user2 } = await loadFixture(deployPactFixture);

                expect(await pact.user1()).to.equal(user1.address);
                expect(await pact.user2()).to.equal(user2.address);
            });

            it("Should NOT have any function to add a 3rd user", async function () {
                const { pact } = await loadFixture(deployPactFixture);

                // Verify there's no addUser, setUser, or similar function
                // by checking the contract interface
                const pactInterface = pact.interface;
                const functionNames = Object.keys(pactInterface.fragments)
                    .filter((key) => pactInterface.fragments[key as any].type === "function")
                    .map((key) => pactInterface.fragments[key as any].name);

                expect(functionNames).to.not.include("addUser");
                expect(functionNames).to.not.include("setUser");
                expect(functionNames).to.not.include("addMember");
                expect(functionNames).to.not.include("addParticipant");
            });

            it("Should reject calls from non-members", async function () {
                const { pact, user3 } = await loadFixture(deployPactFixture);

                await expect(
                    pact.connect(user3).registerPublicKey("0x1234")
                ).to.be.revertedWithCustomError(pact, "NotPactMember");
            });
        });

        describe("Membership", function () {
            it("Should correctly identify members", async function () {
                const { pact, user1, user2, user3 } = await loadFixture(deployPactFixture);

                expect(await pact.isMember(user1.address)).to.be.true;
                expect(await pact.isMember(user2.address)).to.be.true;
                expect(await pact.isMember(user3.address)).to.be.false;
            });

            it("Should return correct partner", async function () {
                const { pact, user1, user2 } = await loadFixture(deployPactFixture);

                expect(await pact.getPartner(user1.address)).to.equal(user2.address);
                expect(await pact.getPartner(user2.address)).to.equal(user1.address);
            });
        });

        describe("Public Keys", function () {
            it("Should allow members to register public keys", async function () {
                const { pact, user1 } = await loadFixture(deployPactFixture);

                const publicKey = ethers.hexlify(ethers.randomBytes(65));
                await expect(pact.connect(user1).registerPublicKey(publicKey))
                    .to.emit(pact, "PublicKeyUpdated");

                expect(await pact.publicKeys(user1.address)).to.equal(publicKey);
            });
        });

        describe("Session Keys", function () {
            it("Should allow registering session keys", async function () {
                const { pact, user1 } = await loadFixture(deployPactFixture);

                const keyHash = ethers.keccak256(ethers.toUtf8Bytes("session-key-1"));
                const validityPeriod = 3600; // 1 hour

                await expect(pact.connect(user1).registerSessionKey(keyHash, validityPeriod))
                    .to.emit(pact, "SessionKeyRegistered");
            });

            it("Should allow rotating session keys", async function () {
                const { pact, user1 } = await loadFixture(deployPactFixture);

                const keyHash1 = ethers.keccak256(ethers.toUtf8Bytes("session-key-1"));
                const keyHash2 = ethers.keccak256(ethers.toUtf8Bytes("session-key-2"));

                await pact.connect(user1).registerSessionKey(keyHash1, 3600);
                await expect(pact.connect(user1).rotateSessionKey(keyHash2, 3600))
                    .to.emit(pact, "SessionKeyRotated");
            });
        });

        describe("Message Registry", function () {
            it("Should register message hashes", async function () {
                const { pact, user1 } = await loadFixture(deployPactFixture);

                const messageHash = ethers.keccak256(ethers.toUtf8Bytes("Hello World"));

                await pact.connect(user1).registerMessageHash(messageHash);
                expect(await pact.verifyMessageHash(messageHash)).to.be.true;
            });
        });

        describe("Status", function () {
            it("Should return correct status", async function () {
                const { pact } = await loadFixture(deployPactFixture);

                const [isActive, created, dissolved] = await pact.getStatus();
                expect(isActive).to.be.true;
                expect(created).to.be.gt(0);
                expect(dissolved).to.equal(0);
            });
        });
    });

    describe("Security: 3rd Party Exclusion", function () {
        it("CRITICAL: No mechanism exists to add 3rd user to existing pact", async function () {
            const { factory, user1, user2, user3 } = await loadFixture(deployFactoryFixture);

            // Create pact
            await factory.createPact(user1.address, user2.address);
            const pactData = await factory.getPact(1);
            const pact = await ethers.getContractAt("BinaryPact", pactData.pactAddress);

            // Verify contract has no way to add user3
            // 1. user3 cannot register keys
            await expect(
                pact.connect(user3).registerPublicKey("0x1234")
            ).to.be.revertedWithCustomError(pact, "NotPactMember");

            // 2. user3 cannot register session keys
            const keyHash = ethers.keccak256(ethers.toUtf8Bytes("malicious"));
            await expect(
                pact.connect(user3).registerSessionKey(keyHash, 3600)
            ).to.be.revertedWithCustomError(pact, "NotPactMember");

            // 3. user1 and user2 are immutable
            expect(await pact.user1()).to.equal(user1.address);
            expect(await pact.user2()).to.equal(user2.address);

            // 4. Verify membership is strictly binary
            expect(await pact.isMember(user1.address)).to.be.true;
            expect(await pact.isMember(user2.address)).to.be.true;
            expect(await pact.isMember(user3.address)).to.be.false;
        });
    });
});
