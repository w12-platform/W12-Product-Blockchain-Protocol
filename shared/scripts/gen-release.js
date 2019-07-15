#!/usr/bin/env node

const config = require('@w12/conventional-changelog');
const releaser = require('conventional-github-releaser');

const token = process.env.CONVENTIONAL_GITHUB_RELEASER_TOKEN;

if (!token) throw new Error('release token not found');

releaser(
    {url: 'https://api.github.com', token, type: 'oauth'},
    {config},
    (err, responses) => {
        if (err) throw err;

        console.log('release changelog has been updated');
    }
);
