// Make the CLI executable after `tsc` (shebang is preserved by TypeScript).
import { chmodSync, existsSync } from 'node:fs'
const bin = new URL('../dist/cli/bin.js', import.meta.url)
if (existsSync(bin)) chmodSync(bin, 0o755)
