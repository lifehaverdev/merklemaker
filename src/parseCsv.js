const fs = require('fs');
const { parse } = require('csv-parse');

/**
 * Parses a CSV file and returns a list of addresses and their holdings.
 * @param {string} filePath - The path to the CSV file.
 * @returns {Promise<Array>} - A promise that resolves to an array of {address, holdings} objects.
 */
const parseCsv = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        const fileName = filePath.toLowerCase();
        const isCoinFile = fileName.includes('coin_');

        fs.createReadStream(filePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }))
            .on('data', (data) => {
                try {
                    if (isCoinFile) {
                        // Handle any coin file format (CULT, MS2, etc)
                        const holdings = parseFloat(data.Balance.replace(/,/g, ''));
                        if (!isNaN(holdings) && holdings > 0) {
                            results.push({
                                address: data.HolderAddress.toLowerCase(),
                                holdings: holdings
                            });
                        }
                    } else {
                        // Handle NFT format
                        const address = data.HolderAddress.toLowerCase();
                        const quantity = parseInt(data.Quantity);
                        if (!isNaN(quantity) && quantity > 0) {
                            results.push({
                                address: address,
                                holdings: quantity
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error processing row in ${fileName}:`, error);
                }
            })
            .on('end', () => {
                if (results.length === 0) {
                    console.warn(`Warning: No valid entries found in ${fileName}`);
                }
                resolve(results);
            })
            .on('error', reject);
    });
};

module.exports = parseCsv;
