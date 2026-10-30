#!/usr/bin/env node
// Throughput / latency benchmark on synthetic text (deterministic PRNG).
//   npm run build && node benchmarks/performance.mjs [--mb 20]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import lib from '../dist/index.js'

const { createConverter, IRCAM_LETTERS } = lib
const args = process.argv.slice(2)
const MB = Number(args.includes('--mb') ? args[args.indexOf('--mb') + 1] : 20)

let seed = 7
const rand = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n)
const letters = IRCAM_LETTERS.map((l) => l.char)
const fillers = [' ', ' ', ' ', ', ', '. ', '\n', ' 2026 ', ' bonjour ', ' مرحبا ', ' 😀 ']
function makeText(bytes) {
  const parts = []
  let size = 0
  while (size < bytes) {
    const w = Array.from({ length: 2 + rand(9) }, () => letters[rand(letters.length)]).join('')
    const f = fillers[rand(fillers.length)]
    parts.push(w, f)
    size += Buffer.byteLength(w) + Buffer.byteLength(f)
  }
  return parts.join('')
}

const text = makeText(MB * 1024 * 1024)
const bytes = Buffer.byteLength(text)
const words = text.split(/\s+/).filter((w) => /[ⴰ-⵿]/.test(w)).length
const report = { node: process.version, inputMiB: +(bytes / 1048576).toFixed(1), tifinaghWords: words, profiles: {} }

for (const profile of ['readable', 'ircam', 'phonetic']) {
  const c = createConverter({ profile })
  c.convert(text.slice(0, 100000)) // warm-up
  const t0 = process.hrtime.bigint()
  const out = c.convert(text).output
  const s = Number(process.hrtime.bigint() - t0) / 1e9
  report.profiles[profile] = { seconds: +s.toFixed(2), MiBperSec: +(bytes / 1048576 / s).toFixed(1), wordsPerSec: Math.round(words / s), outputChars: out.length }
}

// Per-call latency for short inputs (single words / sentences).
const c = createConverter()
const samples = Array.from({ length: 20000 }, () => Array.from({ length: 3 + rand(8) }, () => letters[rand(letters.length)]).join(''))
const lat = []
for (const w of samples) {
  const t = process.hrtime.bigint()
  c.convert(w)
  lat.push(Number(process.hrtime.bigint() - t) / 1000)
}
lat.sort((a, b) => a - b)
report.shortInputLatencyMicroseconds = { p50: +lat[lat.length >> 1].toFixed(1), p99: +lat[Math.floor(lat.length * 0.99)].toFixed(1) }

// CLI streaming throughput on a file.
const dir = mkdtempSync(join(tmpdir(), 'amz-bench-'))
const inFile = join(dir, 'in.txt')
const outFile = join(dir, 'out.txt')
writeFileSync(inFile, text)
const t0 = process.hrtime.bigint()
execFileSync(process.execPath, [new URL('../dist/cli/bin.js', import.meta.url).pathname, inFile, '-o', outFile])
const s = Number(process.hrtime.bigint() - t0) / 1e9
report.cliStreaming = { seconds: +s.toFixed(2), MiBperSec: +(bytes / 1048576 / s).toFixed(1), outputMiB: +(statSync(outFile).size / 1048576).toFixed(1) }
report.memoryRssMiB = Math.round(process.memoryUsage().rss / 1048576)
rmSync(dir, { recursive: true, force: true })
console.log(JSON.stringify(report, null, 2))
