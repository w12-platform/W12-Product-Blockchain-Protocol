#!/usr/bin/env bash
cp example.config.js config.js
npm run t:migrate:r:test
# because `build/` in gitignore
git add -f build/
git commit -m "chore: migration of version $(npm run --silent version) [ci skip]"
# push from detached head
git push origin HEAD:master
