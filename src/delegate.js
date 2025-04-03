//here is a javascript slop that we used to perform that transformation

import { promises as fsPromises, existsSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { ethers } from 'ethers';
import 'dotenv/config';

const INFURA_ID = process.env.INFURA_ID;
if (!INFURA_ID) {
  throw new Error('Please set INFURA_ID environment variable');
}

const DELEGATE_V1 = '0x00000000000076A84feF008CDAbe6409d2FE638B';
const DELEGATE_V2 = '0x00000000000000447e69651d841bD8D104Bed493';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mergeObjects(obj1, obj2) {
  const merged = {};

  // Function to merge arrays and remove duplicates
  function mergeArrays(arr1, arr2) {
    return [...new Set([...arr1, ...arr2])];
  }

  // Merge keys from obj1
  for (const key in obj1) {
    if (obj1.hasOwnProperty(key)) {
      merged[key] = obj2.hasOwnProperty(key) ? mergeArrays(obj1[key], obj2[key]) : obj1[key];
    }
  }

  // Merge keys from obj2 that are not in obj1
  for (const key in obj2) {
    if (obj2.hasOwnProperty(key) && !merged.hasOwnProperty(key)) {
      merged[key] = obj2[key];
    }
  }

  return merged;
}

async function getEvents (_contract, _firstBlock, _lastBlock, _eventName) {
  let ranges = [ [ _firstBlock, _lastBlock ] ];
  let events = [];
  while (ranges.length > 0) {
    let [ start, end ] = ranges.shift();
    console.log(ranges.length, start, end);
    try {
      const eventChunk = await _contract.queryFilter(_eventName, start, end);
      events = events.concat(eventChunk);
    } catch (error) {
      const midBlock = start + Math.floor((end - start) / 2);
      ranges.push([start, midBlock], [midBlock + 1, end]);
    }
  }
  return events;
}

const main = async () => {
  const provider = new ethers.InfuraProvider('mainnet', INFURA_ID); 

  // Set up delegate contracts
  let delegateV1 = new ethers.Contract(
    DELEGATE_V1,
    [
      {"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"vault","type":"address"},{"indexed":false,"internalType":"address","name":"delegate","type":"address"},{"indexed":false,"internalType":"bool","name":"value","type":"bool"}],"name":"DelegateForAll","type":"event"}
    ],
    provider
  );
  let delegateV2 = new ethers.Contract(
    DELEGATE_V2,
    [
      {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"bytes32","name":"rights","type":"bytes32"},{"indexed":false,"internalType":"bool","name":"enable","type":"bool"}],"name":"DelegateAll","type":"event"}
    ],
    provider
  );

  // First, build the delegation mapping
  console.log('Processing delegates...');
  const delegates = {};
  let delegateEvents = await getEvents(delegateV1, 0, 19980201, 'DelegateForAll');
  for (let delegateEvent of delegateEvents) {
    let vault = delegateEvent.args.vault.toLowerCase();
    let delegate = delegateEvent.args.delegate.toLowerCase();
    let active = delegateEvent.args.value;
    if (active) {
      delegates[vault] = delegate;
    } else if (delegates.hasOwnProperty(vault)) {
      delete delegates[vault];
    }
  }
  
  delegateEvents = await getEvents(delegateV2, 0, 19980201, 'DelegateAll');
  for (let delegateEvent of delegateEvents) {
    let vault = delegateEvent.args.from.toLowerCase();
    let delegate = delegateEvent.args.to.toLowerCase();
    let active = delegateEvent.args.enable;
    if (active) {
      delegates[vault] = delegate;
    } else if (delegates.hasOwnProperty(vault)) {
      delete delegates[vault];
    }
  }

  // Create output directory if it doesn't exist
  const outputDir = 'output/delegated_whitelists';
  if (!existsSync(outputDir)) {
    await fsPromises.mkdir(outputDir, { recursive: true });
  }

  // Process all whitelist files
  const whitelistPath = 'output/cultexec_whitelists';
  const files = await fsPromises.readdir(whitelistPath);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    console.log(`Processing ${file}...`);
    const filePath = resolvePath(whitelistPath, file);
    const whitelistData = JSON.parse(await fsPromises.readFile(filePath, 'utf8'));
    let modified = false;

    // Create a new array for modified addresses
    const modifiedAddresses = [...whitelistData.addresses];

    // Process each address in the whitelist
    for (let i = 0; i < modifiedAddresses.length; i++) {
      const address = modifiedAddresses[i].toLowerCase();
      if (delegates.hasOwnProperty(address)) {
        const delegate = delegates[address];
        if (delegate !== address) {
          console.log(`${file}: ${address} -> ${delegate}`);
          modifiedAddresses[i] = delegate;
          modified = true;
        }
      }
    }

    // Save modified whitelist
    if (modified) {
      const outputPath = resolvePath(outputDir, file);
      const outputData = {
        ...whitelistData,
        addresses: modifiedAddresses
      };
      await fsPromises.writeFile(
        outputPath,
        JSON.stringify(outputData, null, 2)
      );
      console.log(`Saved delegated whitelist to ${outputPath}`);
    }
  }
};

main().catch(console.error);