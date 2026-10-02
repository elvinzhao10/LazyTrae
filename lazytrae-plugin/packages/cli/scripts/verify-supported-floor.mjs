#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { verifyFloor } from './shared/floor-runner.mjs';

process.exitCode = verifyFloor({
  root: fileURLToPath(new URL('..', import.meta.url)),
  defaultSurface: 'onboarding-lsp',
  surfaces: {"cli":"18.0.0","onboarding-lsp":"20.0.0"},
  cliExercises: { package: ['test/supported-floor-cli.cjs', 'package'], install: ['test/supported-floor-cli.cjs', 'install'], cli: ['bin/lazytrae.js', '--help'] },
  exercises: {
  "package": [
    "--test",
    "test/lifecycle-core.test.js"
  ],
  "install": [
    "--test",
    "test/lifecycle-bootstrap.test.js"
  ],
  "onboarding": [
    "--test",
    "test/lifecycle-command.test.js"
  ],
  "lsp-provider": [],
  "cli": [
    "bin/lazytrae.js",
    "--help"
  ]
},
});
