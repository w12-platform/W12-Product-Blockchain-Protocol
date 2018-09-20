#!/usr/bin/env node

// This script generate abi from artifacts for every version that has different from previously
// It take artifacts from build/contracts/ and generate to abi/{verion}/
// As result output artifact has size less then origin due to the fact that it leaves only abi

const fs = require('fs');
const path = require('path');
const semint = require('@redtea/semint');
const semver = require('semver');
const _ =  require('lodash');
const version = require('../../package.json').version;

const ABI_DIR = path.join(process.cwd(), 'abi/');
const BUILD_DIR = path.join(process.cwd(), 'build/contracts/');
const vPath = (r) => path.join(ABI_DIR, r);
const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        filelist = fs.statSync(path.join(dir, file)).isDirectory()
            ? walkSync(path.join(dir, file), filelist)
            : filelist.concat(path.join(dir, file));
    });
    return filelist;
};
const mkdir = (p) => !fs.existsSync(p) && fs.mkdirSync(p);
const readJsons = (paths) => paths.map(p => ({ path: p, json: require(p) }));
const generate = (ver, prevAbi, artifacts) => {
    const theSame = artifacts.every(a => {
        const name = a.json.contractName;
        const found = prevAbi.find(a => a.json.contractName === name);

        if (!found) return false;

        return _.isEqual(a.json.abi, found.json.abi);
    });

    if (theSame) return null;

    return artifacts.map(a => {
       return {
           path: path.join(vPath(ver), a.path.replace(BUILD_DIR, '')),
           json: {
               contractName: a.json.contractName,
               abi: _.cloneDeep(a.json.abi)
           }
       };
    });
};
const save = (ver, abi) => {
    mkdir(vPath(ver));

    for (const item of abi) {
        fs.writeFileSync(item.path, JSON.stringify(item.json, null, 2));
    }
}
const nothing = () => {
    console.log('[abi] nothing to generate');
    process.exit();
};

if (!semint.isValid(version, 4)) throw new Error('[abi] version in package.json is not valid');
if (!fs.existsSync(BUILD_DIR)) throw new Error('[abi] build contracts before');

// make dir for ABI if not exists
mkdir(ABI_DIR);

// check if abi already exists for current version
if (fs.existsSync(vPath(version))) {
    nothing();
}

const versions = fs.readdirSync(ABI_DIR);
const artifactsPaths = walkSync(BUILD_DIR);

if (artifactsPaths.length === 0) throw new Error('[abi] no artifacts');

// sort desc
versions.sort((a, b) => {
    if (semver.satisfies(a, b)) return 0;
    if (semver.gt(a, b)) return -1;
    return 1;
});

const lastVersion = versions.length ? versions[versions.length - 1]: null;
const lastVersionAbiPaths = lastVersion ? walkSync(vPath(lastVersion)) : [];
const result = generate(version, readJsons(lastVersionAbiPaths), readJsons(artifactsPaths));

if (!result) {
    nothing();
}

save(version, result);

console.log(`[abi] version ${version} successful generated`);

