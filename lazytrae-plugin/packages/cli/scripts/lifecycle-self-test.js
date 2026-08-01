'use strict';

const { verifyStagedPackage } = require('../src/lib/lifecycle/bootstrap');

const result = verifyStagedPackage(process.cwd(), 'LazyTrae');
process.stdout.write(`${JSON.stringify({ product: 'LazyTrae', status: 'passed', version: result.version })}\n`);
