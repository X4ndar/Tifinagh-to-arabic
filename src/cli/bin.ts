#!/usr/bin/env node
import { main } from './cli'

main(process.argv.slice(2), { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr }).then(
  (code) => {
    process.exitCode = code
  },
  (err: unknown) => {
    process.stderr.write(`fatal: ${(err as Error)?.stack ?? String(err)}\n`)
    process.exitCode = 2
  },
)
