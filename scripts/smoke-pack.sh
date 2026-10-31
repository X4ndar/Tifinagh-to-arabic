#!/usr/bin/env bash
# Install the packed tarball into an empty project and use it like a consumer would.
#   npm run build && bash scripts/smoke-pack.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
TARBALL="$(cd "$ROOT" && npm pack --silent --pack-destination "$WORK")"
cd "$WORK"
npm init -y >/dev/null
npm install --no-audit --no-fund "./$TARBALL" >/dev/null

# CommonJS
node -e "
const m = require('amazigh-transliterate')
const eq = (a, b) => { if (a !== b) { console.error('FAIL', a, '!==', b); process.exit(1) } }
eq(m.toArabic('ⵜⴰⵎⴰⵣⵉⵖⵜ'), 'تامازيغت')
eq(m.convert('ⴰⵎⵖⴰⵔ', { from: 'tifinagh', to: 'arabic' }).output, 'أمغار')
eq(m.convert('ⵜⴰⵎⵓⵔⵜ', { to: 'latin' }).output, 'tamurt')
eq(require('amazigh-transliterate/package.json').name, 'amazigh-transliterate')
console.log('cjs ok')"

# ES module
node --input-type=module -e "
import m from 'amazigh-transliterate'
import { toArabic } from 'amazigh-transliterate'
if (m.toArabic('ⴰⵣⵓⵍ') !== 'أزول' || toArabic('ⴰⵣⵓⵍ', { profile: 'ircam' }) !== 'ازول') process.exit(1)
console.log('esm ok')"

# CLI from node_modules/.bin
test "$(npx --no-install amazigh-transliterate --text 'ⵉⴼⴰⵙⵙⵏ')" = "ئفاسّن"
printf 'ⴰⵣⵓⵍ\n\nⵓⴽⵙⵓⵎ' | npx --no-install amazigh-transliterate > out.txt
printf 'أزول\n\nؤكسوم' | cmp - out.txt
echo "cli ok"

# TypeScript declarations
cat > check.ts <<'TS'
import { createConverter, transliterate, type ArabicOptions, type ConvertResult, type ProfileId } from 'amazigh-transliterate'
const p: ProfileId = 'phonetic'
const o: Partial<ArabicOptions> = { gemination: 'double', initialVowels: 'hamza-seat' }
const r = transliterate('ⴰⵣⵓⵍ', { profile: p, arabic: o, alternatives: true })
const first: string | undefined = r.alternatives?.[0]?.alternatives[0]?.output
const c: ConvertResult | undefined = undefined
console.log(createConverter().convert('ⴰ').output, first, c)
TS
"$ROOT/node_modules/.bin/tsc" --noEmit --strict --module commonjs --target es2019 --esModuleInterop --skipLibCheck false --types node --typeRoots "$ROOT/node_modules/@types" check.ts
echo "types ok"

# Python bridge against the installed CLI
AMAZIGH_TRANSLITERATE_CLI="$WORK/node_modules/.bin/amazigh-transliterate" python3 -c "
import sys; sys.path.insert(0, '$WORK/node_modules/amazigh-transliterate/python')
from amazigh_transliterate import Transliterator
with Transliterator() as tr:
    assert tr.convert('ⵜⴰⵎⴰⵣⵉⵖⵜ') == 'تامازيغت'
print('python ok')"

# contents: no tests, no unlicensed data
tar -tzf "$TARBALL" | grep -Eq '^package/(tests|data|benchmarks)/' && { echo 'unexpected files in package'; exit 1; }
echo "package contents ok ($(tar -tzf "$TARBALL" | wc -l) files)"
