#!/usr/bin/env bash
set -e

#cp example.config.js config.js
echo "run migration..."

if ! MIGRATE_LOG=$(npm run t:migrate:r:test); then
    echo "$MIGRATE_LOG"
    exit $?
fi

echo "$MIGRATE_LOG"

# because `build/` in gitignore
git add -f build/

git commit -m \
"chore: migration of version $(npm run --silent version) [ci skip]"\
$'\n\n'\
"$MIGRATE_LOG"

# push from detached head
git push origin HEAD:master
