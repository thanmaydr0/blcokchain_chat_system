import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying DuoGraph Binary Pact Protocol to Ethereum Sepolia...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer address:", deployer.address);
    console.log("💰 Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy PactFactory
    console.log("1️⃣ Deploying PactFactory...");
    const PactFactory = await ethers.getContractFactory("PactFactory");
    const pactFactory = await PactFactory.deploy();
    await pactFactory.waitForDeployment();
    const pactFactoryAddress = await pactFactory.getAddress();
    console.log("   ✅ PactFactory deployed to:", pactFactoryAddress);

    // Deploy DuoGraphAccountFactory
    // ERC-4337 EntryPoint v0.6 on Sepolia
    const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

    console.log("\n2️⃣ Deploying DuoGraphAccountFactory...");
    const DuoGraphAccountFactory = await ethers.getContractFactory("DuoGraphAccountFactory");
    const accountFactory = await DuoGraphAccountFactory.deploy(ENTRY_POINT);
    await accountFactory.waitForDeployment();
    const accountFactoryAddress = await accountFactory.getAddress();
    console.log("   ✅ DuoGraphAccountFactory deployed to:", accountFactoryAddress);

    // Deploy PaymasterContract
    console.log("\n3️⃣ Deploying PaymasterContract...");
    const PaymasterContract = await ethers.getContractFactory("PaymasterContract");
    const paymaster = await PaymasterContract.deploy(ENTRY_POINT, pactFactoryAddress);
    await paymaster.waitForDeployment();
    const paymasterAddress = await paymaster.getAddress();
    console.log("   ✅ PaymasterContract deployed to:", paymasterAddress);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n📋 Contract Addresses:");
    console.log(`   PactFactory:            ${pactFactoryAddress}`);
    console.log(`   DuoGraphAccountFactory: ${accountFactoryAddress}`);
    console.log(`   PaymasterContract:      ${paymasterAddress}`);
    console.log("\n📝 Next Steps:");
    console.log("   1. Verify contracts on Etherscan:");
    console.log(`      npx hardhat verify --network sepolia ${pactFactoryAddress}`);
    console.log(`      npx hardhat verify --network sepolia ${accountFactoryAddress} ${ENTRY_POINT}`);
    console.log(`      npx hardhat verify --network sepolia ${paymasterAddress} ${ENTRY_POINT} ${pactFactoryAddress}`);
    console.log("   2. Fund the Paymaster contract with ETH for gas sponsorship");
    console.log("   3. Update frontend .env with contract addresses\n");

    // Save deployment info to file
    const deploymentInfo = {
        network: "sepolia",
        chainId: 11155111,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            PactFactory: pactFactoryAddress,
            DuoGraphAccountFactory: accountFactoryAddress,
            PaymasterContract: paymasterAddress,
        },
        entryPoint: ENTRY_POINT,
    };

    const fs = await import("fs");
    fs.writeFileSync(
        "./deployments.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("💾 Deployment info saved to deployments.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
