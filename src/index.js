const fs = require('fs');
const path = require('path');
const parseCsv = require('./parseCsv');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

// Get command line arguments
const projectTitle = process.argv[2];
const percentageArg = process.argv[3];
const testAddress = process.argv[4];

if (!projectTitle) {
    console.error('Please provide a project title as a command-line argument.');
    process.exit(1);
}

// Parse percentage, default to 100 if not provided
const percentage = percentageArg ? parseFloat(percentageArg) : 100;
if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
    console.error('Percentage must be a number between 0 and 100');
    process.exit(1);
}

// Validate test address if provided
if (testAddress) {
    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(testAddress);
    if (!isValidAddress) {
        console.error('Invalid Ethereum address format');
        process.exit(1);
    }
}

// Define the input and output directories
const inputDir = path.join(__dirname, '../data', projectTitle);
const outputDir = path.join(__dirname, '../output');

const processProject = async () => {
    try {
        const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.csv'));
        
        if (files.length === 0) {
            console.error(`No CSV files found in the directory: ${inputDir}`);
            process.exit(1);
        }

        // Change to store address-to-holdings mapping
        const addressHoldings = new Map();

        // Collect all addresses and sum their holdings
        for (const file of files) {
            const filePath = path.join(inputDir, file);
            const entries = await parseCsv(filePath);
            
            entries.forEach(({ address, holdings }) => {
                const currentHoldings = addressHoldings.get(address) || 0;
                addressHoldings.set(address, currentHoldings + holdings);
            });
        }

        // Convert to array and sort by holdings (descending)
        const sortedAddresses = Array.from(addressHoldings.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by holdings
            .map(([address]) => address); // Keep only addresses

        const totalAddresses = sortedAddresses.length;
        const addressesToInclude = Math.ceil((percentage / 100) * totalAddresses);
        
        // Take top N% of holders
        const selectedAddresses = sortedAddresses.slice(0, addressesToInclude);

        // Add test address if provided and not already included
        if (testAddress && !selectedAddresses.includes(testAddress)) {
            selectedAddresses.push(testAddress);
            console.log(`Added test address: ${testAddress}`);
        }

        // Prepare output data - simplified to just addresses
        const outputData = {
            addresses: selectedAddresses,
            totalAddresses: totalAddresses,
            includedAddresses: selectedAddresses.length,
            percentage: percentage,
            testAddress: testAddress || null
        };

        // Create output file with percentage in the name
        const percentageStr = percentage.toString().padStart(3, '0');
        const baseFileName = `unique_addresses_${projectTitle}_${percentageStr}pct.json`;
        
        // Save addresses
        fs.writeFileSync(
            path.join(outputDir, baseFileName),
            JSON.stringify(outputData, null, 2)
        );
        
        console.log(`Successfully processed ${projectTitle} (${percentage}%)`);
        console.log(`Total addresses: ${totalAddresses}`);
        console.log(`Included addresses: ${selectedAddresses.length}`);
        if (testAddress) {
            console.log(`Test address included: ${testAddress}`);
        }
        console.log(`Output saved to ${baseFileName}`);
    } catch (error) {
        console.error(`Error processing ${projectTitle}:`, error);
    }
};

processProject();