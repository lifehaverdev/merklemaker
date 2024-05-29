# Merkle Maker

This program takes etherscan holder csv's and creates an array of unique address for the purpose of creating merkle trees.

# How to

Get your holder csv's from etherscan and put them into data in a projectfolder with whatever name you want.

Then use
```node src/index.js <PROJECT NAME>```
from the terminal to create an array of unique addresses in the output folder from the csvs.