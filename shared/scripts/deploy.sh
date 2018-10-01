#!/usr/bin/env bash
cp example.config.js config.js

echo "run migration..."

MIGRATE_LOG=$(npm run --silent t:migrate:r:test);
EXIT_STATUS=$?

echo "$MIGRATE_LOG"

if  [ ${EXIT_STATUS} -gt 0 ]
then
    echo "migration script exit with status $EXIT_STATUS";
    exit $EXIT_STATUS;
fi

set -e

# because `build/` in gitignore
git add -f build/

git commit -m \
"chore: migration of version $(npm run --silent version) [ci skip]"\
$'\n\n'\
"$MIGRATE_LOG"

# push from detached head
git push origin HEAD:master
