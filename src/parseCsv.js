const fs = require('fs');
const { parse } = require('csv-parse');
const path = require('path');

/**
 * Parses a CSV file and returns a list of addresses and their holdings.
 * @param {string} filePath - The path to the CSV file.
 * @returns {Promise<Array>} - A promise that resolves to an array of {address, holdings} objects.
 */
const parseCsv = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }))
            .on('data', (data) => {
                // Clean up the balance - remove commas and convert to number
                const holdings = parseFloat(data.Balance.replace(/,/g, ''));
                
                results.push({
                    address: data.HolderAddress,
                    holdings: holdings
                });
            })
            .on('end', () => {
                resolve(results);
            })
            .on('error', reject);
    });
};

module.exports = parseCsv;
