// Randomized test suites at 20,000 cases each. Cross-platform (Windows PowerShell too):
//   npm run test:heavy
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const jest = require.resolve('jest/bin/jest')
const files = ['tests/property.test.ts', 'tests/metamorphic.test.ts', 'tests/roundtrip.test.ts']
const r = spawnSync(process.execPath, [jest, ...files, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, FC_RUNS: process.env.FC_RUNS || '20000' },
})
process.exit(r.status ?? 1)
