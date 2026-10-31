// Make the command-line entry points executable after `tsc` (TypeScript keeps the shebang).
import { chmodSync, existsSync } from 'node:fs'
for (const rel of ['../dist/cli/bin.js', '../dist/server/bin.js']) {
  const file = new URL(rel, import.meta.url)
  if (existsSync(file)) chmodSync(file, 0o755)
}
