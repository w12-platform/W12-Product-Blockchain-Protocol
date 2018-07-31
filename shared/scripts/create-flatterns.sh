#!/usr/bin/env bash
PATHS=`ls contracts/`

rm -rf flats/*

for FILE in $PATHS;
do
  echo "creating: flats/$FILE";
  solidity_flattener --solc-paths="openzeppelin-solidity=$PWD/openzeppelin-solidity" --output flats/$FILE contracts/$FILE;
done

