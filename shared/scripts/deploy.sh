#!/usr/bin/env bash
npm run t:migrate:r:test
git add .
git commit -m "chore: migration of version $(npm run --silent version)"
git push origin master
