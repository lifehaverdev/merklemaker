const fs = require('fs');
const path = require('path');
const parseCsv = require('./parseCsv');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

// Get command line arguments
const projectTitle = process.argv[2];
const command = process.argv[3]; // New: 'analyze' or 'percentage' or 'generate'
const percentageArg = command === 'percentage' ? process.argv[4] : null;
const testAddress = command === 'percentage' ? process.argv[5] : null;

const cultTiers = [1, 2, 4, 8, 15, 29, 56];

// Reorder priority collections to encourage better groupings
const PRIORITY_COLLECTIONS = [
    'bonkler',    // Must include early
    'fumo',       // Small but significant
    'ms2',        // Small but significant
    'milady',     // Core collection
    'miladystation', // Station ecosystem
    'remilio',    // Core collection
    'banners',    // Core collection
    'kagami',     // Mid-size
    'remilio',    // Core collection
    'remix',      // Related to early group
    'bitch',      // Small but significant
    //'schizo',     // Large collection
    //'pixelady',   // Large collection
    //'radbro',     // Large collection
];

if (!projectTitle) {
    console.error('Please provide a project title as a command-line argument.');
    process.exit(1);
}

if (!['analyze', 'percentage', 'generate'].includes(command)) {
    console.error('Please specify command: "analyze", "percentage", or "generate"');
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

const analyzeGrowth = async () => {
    try {
        const files = fs.readdirSync(inputDir);
        
        // Separate CULT and NFT files
        const cultFile = files.find(file => file.startsWith('coin_cult'));
        const nftFiles = files.filter(file => 
            file.endsWith('.csv') && !file.startsWith('coin_cult')
        );

        if (!cultFile) {
            console.error('No CULT token CSV file found (should start with coin_cult)');
            process.exit(1);
        }

        // Process CULT holders
        const cultPath = path.join(inputDir, cultFile);
        const cultEntries = await parseCsv(cultPath);
        
        // Create holdings map and sort holders
        const holdingsMap = new Map();
        cultEntries.forEach(({ address, holdings }) => {
            const current = holdingsMap.get(address) || 0;
            holdingsMap.set(address, current + holdings);
        });

        const sortedHolders = Array.from(holdingsMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([address]) => address);

        // Calculate CULT holder sets at different percentages
        
        const cultSets = new Map();
        
        cultTiers.forEach(percentage => {
            const count = Math.ceil((percentage / 100) * sortedHolders.length);
            cultSets.set(percentage, new Set(sortedHolders.slice(0, count)));
        });

        // Process NFT collections
        const nftSets = new Map();
        for (const file of nftFiles) {
            const filePath = path.join(inputDir, file);
            const entries = await parseCsv(filePath);
            const collectionName = path.basename(file, '.csv');
            nftSets.set(collectionName, new Set(entries.map(e => e.address)));
        }

        // Analyze growth for each CULT tier
        console.log('\n=== Growth Analysis ===');
        
        // First show CULT tier progression
        console.log('CULT Tier Progression:');
        for (let i = 1; i < cultTiers.length; i++) {
            const prevPct = cultTiers[i-1];
            const currentPct = cultTiers[i];
            const prevSet = cultSets.get(prevPct);
            const currentSet = cultSets.get(currentPct);
            const newAddresses = new Set([...currentSet].filter(x => !prevSet.has(x)));
            
            console.log(`\n${prevPct}% -> ${currentPct}%:`);
            console.log(`  +${newAddresses.size} new addresses (${currentSet.size} total)`);
        }

        // Then analyze NFT additions for each CULT tier
        for (const cultPct of cultTiers) {
            const cultSet = cultSets.get(cultPct);
            console.log(`\n\n=== NFT Additions from ${cultPct}% CULT Base (${cultSet.size} addresses) ===`);
            
            // Sort NFT collections by size for consistent output
            const sortedCollections = Array.from(nftSets.entries())
                .sort((a, b) => b[1].size - a[1].size);

            for (const [name, addresses] of sortedCollections) {
                const combined = new Set([...cultSet, ...addresses]);
                const newAddresses = new Set([...addresses].filter(x => !cultSet.has(x)));
                
                console.log(`\n${name}:`);
                console.log(`  +${newAddresses.size} new addresses (${combined.size} total)`);
                console.log(`  Collection size: ${addresses.size}`);
                const overlap = new Set([...addresses].filter(x => cultSet.has(x)));
                console.log(`  Overlap with ${cultPct}% CULT: ${overlap.size} addresses`);
            }
        }

    } catch (error) {
        console.error('Analysis error:', error);
    }
};

const generateWhitelists = async () => {
    try {
        const files = fs.readdirSync(inputDir);
        const cultFile = files.find(file => file.startsWith('coin_cult'));
        const nftFiles = files.filter(file => 
            file.endsWith('.csv') && !file.startsWith('coin_cult')
        );

        // Process CULT holders
        const cultPath = path.join(inputDir, cultFile);
        const cultEntries = await parseCsv(cultPath);
        const holdingsMap = new Map();
        cultEntries.forEach(({ address, holdings }) => {
            holdingsMap.set(address, (holdingsMap.get(address) || 0) + holdings);
        });

        const sortedHolders = Array.from(holdingsMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([address]) => address);

        // Calculate CULT tiers
        const cultTiers = [1, 2, 4, 8, 15, 29, 56];
        const cultSets = new Map();
        cultTiers.forEach(percentage => {
            const count = Math.ceil((percentage / 100) * sortedHolders.length);
            cultSets.set(percentage, new Set(sortedHolders.slice(0, count)));
        });

        // Process NFT collections
        const nftSets = new Map();
        const monySet = new Set();

        for (const file of nftFiles) {
            const filePath = path.join(inputDir, file);
            const entries = await parseCsv(filePath);
            const collectionName = path.basename(file, '.csv').replace('coin_', '');

            // Combine specific collections into 'mony'
            if (['miladystation', 'cigstation', 'tubbystation', 'missingno'].includes(collectionName)) {
                entries.forEach(entry => monySet.add(entry.address));
            } else {
                nftSets.set(collectionName, new Set(entries.map(e => e.address)));
            }
        }

        // Add the combined 'mony' set
        if (monySet.size > 0) {
            nftSets.set('mony', monySet);
        }

        // Create output directory for whitelists
        const whitelistDir = path.join(outputDir, `${projectTitle}_whitelists`);
        if (!fs.existsSync(whitelistDir)) {
            fs.mkdirSync(whitelistDir, { recursive: true });
        }

        // Generate optimal groupings
        const whitelists = findOptimalGroups(cultSets, nftSets);
        
        // Save whitelists
        whitelists.forEach((whitelist, index) => {
            const dayNum = (index + 1).toString().padStart(2, '0');
            const fileName = `${dayNum}_${whitelist.name}.json`;
            const filePath = path.join(whitelistDir, fileName);
            
            const output = {
                day: index + 1,
                name: whitelist.name,
                description: whitelist.description,
                addresses: Array.from(whitelist.addresses),
                totalAddresses: whitelist.addresses.size,
                components: whitelist.components
            };

            fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
            console.log(`Generated ${fileName} with ${output.totalAddresses} addresses`);
        });

    } catch (error) {
        console.error('Error generating whitelists:', error);
    }
};

const findOptimalGroups = (cultSets, nftSets) => {
    const whitelists = [];
    const usedCollections = new Set();
    let allPreviousAddresses = new Set();
    
    // Start with CULT 1%
    let currentBase = cultSets.get(1);
    allPreviousAddresses = new Set([...currentBase]);
    whitelists.push({
        name: 'cult_1',
        description: 'CULT Token Top 1% Holders',
        addresses: allPreviousAddresses,
        components: ['CULT 1%']
    });

    for (let i = 1; i < cultTiers.length; i++) {
        const currentPct = cultTiers[i];
        const prevPct = cultTiers[i-1];
        const nextCultSize = cultSets.get(currentPct).size - cultSets.get(prevPct).size;

        // Skip NFT group before final CULT tier (56%)
        if (currentPct !== 56) {
            // Find best NFT combination
            const bestGroup = findBestNFTCombination(
                nftSets,
                usedCollections,
                allPreviousAddresses,
                nextCultSize
            );

            if (bestGroup.collections.length > 0) {
                // Add NFT group whitelist, including all previous addresses
                const newAddresses = new Set([...allPreviousAddresses, ...bestGroup.addresses]);
                whitelists.push({
                    name: bestGroup.collections.join(''),
                    description: `NFT Collections: ${bestGroup.collections.join(', ')}`,
                    addresses: newAddresses,
                    components: bestGroup.collections
                });
                
                // Update all previous addresses
                allPreviousAddresses = newAddresses;
                bestGroup.collections.forEach(name => usedCollections.add(name));
            }
        }

        // Add next CULT percentage
        const newCultAddresses = cultSets.get(currentPct);
        allPreviousAddresses = new Set([...allPreviousAddresses, ...newCultAddresses]);
        whitelists.push({
            name: `cult_${currentPct}`,
            description: `CULT Token Top ${currentPct}% Holders`,
            addresses: allPreviousAddresses,
            components: [`CULT ${currentPct}%`]
        });
    }

    return whitelists;
};

const findBestNFTCombination = (nftSets, usedCollections, baseAddresses, targetSize) => {
    // Calculate ideal growth rate for smooth progression
    const calculateGrowthScore = (newAddresses, targetSize) => {
        // Penalize both undershooting and overshooting the target
        const ratio = newAddresses / targetSize;
        // Score is best (1.0) when ratio is close to 1
        // Falls off exponentially as ratio deviates from 1
        return 1 / (Math.abs(Math.log(ratio)) + 1);
    };

    const availableCollections = Array.from(nftSets.entries())
        .filter(([name]) => !usedCollections.has(name))
        .map(([name, addresses]) => {
            const effectiveSize = new Set([...addresses].filter(addr => !baseAddresses.has(addr))).size;
            const priorityScore = PRIORITY_COLLECTIONS.includes(name) ? 
                (PRIORITY_COLLECTIONS.length - PRIORITY_COLLECTIONS.indexOf(name)) : 0;
            return { name, addresses, effectiveSize, priorityScore };
        })
        .sort((a, b) => b.effectiveSize - a.effectiveSize);

    let bestCombination = {
        collections: [],
        addresses: new Set(),
        newAddresses: 0,
        growthScore: 0
    };

    // Try combinations of up to 3 collections
    for (let size = 1; size <= 3; size++) {
        const combinations = getCombinations(availableCollections, size);
        
        for (const combo of combinations) {
            const combinedAddresses = new Set([...baseAddresses]);
            let newAddresses = 0;
            
            combo.forEach(({ addresses: collectionAddresses }) => {
                collectionAddresses.forEach(addr => {
                    if (!combinedAddresses.has(addr)) {
                        combinedAddresses.add(addr);
                        newAddresses++;
                    }
                });
            });

            const hasPriority = combo.some(c => PRIORITY_COLLECTIONS.includes(c.name));
            const isLargeCollection = combo.some(c => c.addresses.size > 2000);
            const sizeLimit = hasPriority ? targetSize * 2.5 : 
                            isLargeCollection ? targetSize * 2 : targetSize * 1.5;

            // Calculate growth score
            const growthScore = calculateGrowthScore(newAddresses, targetSize);
            
            // Calculate priority score
            const priorityScore = combo.reduce((sum, c) => sum + c.priorityScore, 0) / combo.length;
            
            // Combined score favors both smooth growth and priority collections
            const combinedScore = (growthScore * 0.7) + (priorityScore / PRIORITY_COLLECTIONS.length * 0.3);

            const currentScore = bestCombination.growthScore;

            if (newAddresses <= sizeLimit && combinedScore > currentScore) {
                bestCombination = {
                    collections: combo.map(({ name }) => name),
                    addresses: combinedAddresses,
                    newAddresses,
                    growthScore: combinedScore
                };
            }
        }
    }

    return bestCombination;
};

// Helper function to generate combinations
const getCombinations = (array, size) => {
    const result = [];
    
    function combine(start, combo) {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }
        
        for (let i = start; i < array.length; i++) {
            combo.push(array[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }
    
    combine(0, []);
    return result;
};

// Main execution
if (command === 'analyze') {
    analyzeGrowth();
} else if (command === 'generate') {
    generateWhitelists();
} else {
    processProject();
}