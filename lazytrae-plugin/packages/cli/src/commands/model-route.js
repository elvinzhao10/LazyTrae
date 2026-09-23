'use strict';

const routing = require('../../contracts/model-routing');

function run(args) {
  return routing.main(args);
}

module.exports = { run };
