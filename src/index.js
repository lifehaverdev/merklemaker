const fs = require('fs');
const path = require('path');
const parseCsv = require('./parseCsv');

// Get the project title from command-line arguments
const projectTitle = process.argv[2];
if (!projectTitle) {
    console.error('Please provide a project title as a command-line argument.');
    process.exit(1);
}

// Define the input and output directories
const inputDir = path.join(__dirname, '../data', projectTitle);
const outputFilePath = path.join(__dirname, '../output', `unique_addresses_${projectTitle}.txt`);

const processProject = async () => {
    try {
        const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.csv'));
        
        if (files.length === 0) {
            console.error(`No CSV files found in the directory: ${inputDir}`);
            process.exit(1);
        }

        const uniqueAddresses = new Set();

        for (const file of files) {
            const filePath = path.join(inputDir, file);
            const addresses = await parseCsv(filePath);
            addresses.forEach(address => uniqueAddresses.add(address));
        }

        const addressesArray = Array.from(uniqueAddresses);
        fs.writeFileSync(outputFilePath, JSON.stringify(addressesArray, null, 2));
        
        console.log(`Successfully processed ${projectTitle}. Unique addresses saved to ${outputFilePath}`);
    } catch (error) {
        console.error(`Error processing ${projectTitle}:`, error);
    }
};

processProject();