#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const solc = require('solc');

const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        filelist = fs.statSync(path.join(dir, file)).isDirectory()
            ? walkSync(path.join(dir, file), filelist)
            : filelist.concat(path.join(dir, file));
    });
    return filelist;
};
const writeSources = (dest, paths) => {
  for (const ph of paths) {
      dest[ph] = { content: fs.readFileSync(ph, { encoding: 'utf-8' }) };
  }
};
const getLog = (result) => {
    let msg = '';

    const contracts = Object.entries(result.contracts);

    for (const record of contracts) {
        const file = record[0];
        const inner = record[1];

        if (!file.includes(contractsDir)) continue;

        msg += `path: ${file}\n`;

        const inners = Object.entries(inner);

        for (const subRecord of inners) {
            const name = subRecord[0];
            const defs = subRecord[1];

            msg += `contract: ${name}\n----------->`;
            msg += `\n${JSON.stringify(defs.evm.gasEstimates, null, 2)}\n`
            msg += '<-----------\n';
        }
    }

    return msg;
}
const cwd = process.cwd();
const contractsDir = path.join(cwd, './contracts');
const paths = walkSync(contractsDir)
    .filter(path => /\.sol$/.test(path));

const settings = {
    language: "Solidity",
    sources: {},
    settings: {
        remappings: [
            `openzeppelin-solidity/=${path.join(cwd, './node_modules/openzeppelin-solidity/')}`,
            `solidity-bytes-utils/=${path.join(cwd, './node_modules/solidity-bytes-utils/')}`
        ],
        evmVersion: 'byzantium',
        optimizer: {
            enabled: true
        },
        outputSelection: {
            "*": {
                "": [
                    "legacyAST",
                    "ast"
                ],
                "*": [
                    "abi",
                    "evm.bytecode.object",
                    "evm.bytecode.sourceMap",
                    "evm.deployedBytecode.object",
                    "evm.deployedBytecode.sourceMap",
                    "evm.gasEstimates"
                ]
            },
        }
    }
};

if (!paths.length) process.exit(0);

writeSources(settings.sources, paths);

const result = JSON.parse(solc.compileStandard(JSON.stringify(settings), (p, a) => {
    if (fs.existsSync(p)) {
        return {contents: fs.readFileSync(p, { encoding: 'utf-8' })};
    }

    return {contents: "pragma solidity ^0.4.24;" };
}));

if (result.errors && result.errors.length) {
    console.log('Errors and warnings: \n\n', JSON.stringify(result.errors, null, 2), '\n\n')
}

console.log('Estimation result: \n\n', getLog(result));
