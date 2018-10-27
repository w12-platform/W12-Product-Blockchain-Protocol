#!/usr/bin/env bash
set -eo pipefail

cp example.config.js config.js

VERSION=$(npm run --silent version);
VERSION_TAG="v$VERSION-alpha";

npm run --silent t:migrate:r:test 2>&1 | tee ".MIGRATE_LOG_v$VERSION"

cat ".MIGRATE_LOG_v$VERSION";

MIGRATE_LOG=$(cat ".MIGRATE_LOG_v$VERSION");
ADDRESSES=$(cat ".MIGRATE_v$VERSION");

npm run abi

# because `build/` in gitignore
git add -f build/
git add abi/

git commit -m \
"chore: migration of version $VERSION_TAG [ci skip]"\
$'\n'\
"LOG: $MIGRATE_LOG"\
$'\n'\
"MIGRATION:"\
$'\n'\
"$ADDRESSES"

git tag "$VERSION_TAG"
git push origin HEAD:alpha-release
git push "$VERSION_TAG"

npm run gen-release
