#!/usr/bin/env node

'use strict';

var path = require('path');
var fs = require('fs');
var shelljs = require('shelljs');
var cli = require('commander');
var cwd = process.cwd();
var installSubsetPackageJson = require('./package.json');
var packageJson = require(cwd + '/package.json');
var spawnSync = require('cross-spawn').sync;

var backup = function (filename) {
  fs.writeFileSync(path.join(cwd, filename + '.backup'), fs.readFileSync(path.join(cwd, filename)));
  fs.unlinkSync(path.join(cwd, filename));
};

var restore = function (filename) {
  fs.writeFileSync(path.join(cwd, filename), fs.readFileSync(path.join(cwd, filenams + '.backup')));
  fs.unlinkSync(path.join(cwd, filename + '.backup'));
};

var omit = function (obj, props) {
  return Object.keys(obj)
    .filter(key => props.indexOf(key) < 0)
    .reduce((acc, key) => Object.assign(acc, {
      [key]: obj[key]
    }), {});
};

var pick = function (obj, props) {
  return Object.keys(obj)
    .filter(key => props.indexOf(key) >= 0)
    .reduce((acc, key) => Object.assign(acc, {
      [key]: obj[key]
    }), {});
};

cli
  .command('install [input_string]')
  .alias('i')
  .option('-d, --clean', 'remove node_modules first')
  .option('--cliOptions', 'Comma separated list of options to provide to install step')
  .option('--onlyDev', 'Flag indicating to only install dev dependencies')
  .option('--npm', 'use npm to install')
  .description('install a given subset defined in package.json')
  .action(function (input_string, options) {
    if (!input_string) {
      throw 'Please provide an install subset name';
    }

    if (!packageJson.subsets) {
      throw 'No install subsets in package.json';
    }

    if (!packageJson.subsets[input_string]) {
      throw 'No install subset with that name';
    }

    const subset = packageJson.subsets[input_string];

    // prune devDependencies according to subset declarations and options
    if (subset.include) {
      packageJson.devDependencies = pick(packageJson.devDependencies, subset.include);
    } else if (subset.exclude) {
      packageJson.devDependencies = omit(packageJson.devDependencies, subset.exclude);
    } else {
      throw 'No valid subset actions found';
    }

    if (options.onlyDev) {
      packageJson.dependencies = new Object();
    }

    // backup package.json and lockfiles to restore later
    backup('package.json');
    backup('package-lock.json');
    backup('yarn.lock');

    if (options.clean) {
      shelljs.rm('-rf', path.join(cwd, 'node_modules'));
    }

    // write the new temp package.json
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(packageJson, null, '  '));

    const cliOptions = options.cliOptions ? options.cliOptions.split(',') : [];
    var installer;
    // choose which installer to use, then spawn
    if (!options.npm && shelljs.which('yarn')) {
      installer = spawnSync('yarn', ['install'].concat(cliOptions), {
        stdio: 'inherit'
      });
    } else {
      installer = spawnSync('npm', ['install'].concat(cliOptions), {
        stdio: 'inherit'
      });
    }

    // restore package.json and lockfiles from backup
    restore('package.json');
    restore('package-lock.json');
    restore('yarn.lock');

    if (installer.status !== 0) {
      throw 'Error code ' + installer.status;
    }

    console.log('Installation of subset "' + input_string + '" successful');
  });

cli.command('*').action(() => cli.help());

cli.version(installSubsetPackageJson.version).parse(process.argv);

if (cli.args.length === 0) cli.help();

process.on('uncaughtException', err => {
  console.log('ERROR: ' + err);
});
