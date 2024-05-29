const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

/**
 * Parses a CSV file and returns a list of unique Ethereum addresses.
 * @param {string} filePath - The path to the CSV file.
 * @returns {Promise<Set<string>>} - A promise that resolves to a set of unique addresses.
 */
const parseCsv = (filePath) => {
    return new Promise((resolve, reject) => {
        const addresses = new Set();
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                addresses.add(row.HolderAddress);
            })
            .on('end', () => {
                resolve(addresses);
            })
            .on('error', reject);
    });
};

module.exports = parseCsv;
