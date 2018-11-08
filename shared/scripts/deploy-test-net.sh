#!/usr/bin/env bash
set -eo pipefail

cp example.config.js config.js

VERSION=$(npm run --silent version);
VERSION_TAG="v$VERSION-alpha.0";

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
git push origin "$VERSION_TAG"

npm run gen-release

chmod +x ./shared/scripts/notify.sh
./shared/scripts/notify.sh \
"w12-platform/W12-Product-Blockchain-Protocol $VERSION_TAG"\
$'\n\n'\
"https://github.com/w12-platform/W12-Product-Blockchain-Protocol/releases/tag/$VERSION_TAG"\
$'\n\n'\
"$ADDRESSES"
