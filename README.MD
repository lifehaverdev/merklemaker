# CULT Exec Whitelist Generator

This project is designed to generate whitelists for CULT execs by processing CSV files of token and NFT holders. The program creates a series of whitelists based on predefined CULT token percentage tiers and optimally grouped NFT collections.

## Features

- **CULT Token Tiers**: Automatically processes CULT token holders into percentage-based tiers (1%, 2%, 4%, 8%, 15%, 29%, 56%).
- **NFT Collection Grouping**: Combines NFT collections into optimal groups to create a smooth progression of whitelist sizes.
- **Custom Grouping**: Combines specific collections (e.g., `miladystation`, `cigstation`, `tubbystation`, `missingno`) into a single super set called `mony`.

## Usage

### Prerequisites

- Node.js installed on your machine
- CSV files of token and NFT holders placed in the `data/cultexec` directory

### Running the Script

To generate the whitelists, use the following command:
```bash
node src/index.js <PROJECT NAME>
```

To generate the delegated cultexec whitelists, add a .env with an INFURA_ID and use the following command:
```bash
node src/delegate.js
```

### Command Explanation

- `cultexec`: The project title, which corresponds to the directory under `data/` where your CSV files are stored.
- `generate`: The command to generate the whitelists.

### Output

The script will create a series of JSON files in the `output/cultexec_whitelists` directory. Each file represents a day's whitelist, named sequentially (e.g., `01_cult_1.json`, `02_mony.json`, etc.).

## Directory Structure

- `data/cultexec/`: Directory containing your input CSV files.
- `output/cultexec_whitelists/`: Directory where the generated whitelist JSON files will be saved.

## Customization
    
You can customize the priority of NFT collections by modifying the `PRIORITY_COLLECTIONS` array in `src/index.js`. This affects how collections are grouped and prioritized in the whitelist generation process.

## Contributing

Feel free to open issues or submit pull requests for improvements or bug fixes.

## License

This project is unlicensed under the vpl