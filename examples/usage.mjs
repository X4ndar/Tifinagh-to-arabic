// Run after `npm run build`:  node examples/usage.mjs
import lib from '../dist/index.js'
const { toArabic, transliterate, convert, createConverter, Lexicon } = lib

// 1. Simplest use: returns a string
console.log(toArabic('ⵜⴰⵎⴰⵣⵉⵖⵜ')) // تامازيغت

// 2. Upstream-compatible convert() with an Arabic target
console.log(convert('ⴰⵣⵓⵍ, bonjour! 2026 ⵜⴰⵎⴰⵣⵉⵖⵜ', { from: 'tifinagh', to: 'arabic', profile: 'readable' }).output)

// 3. Profiles
for (const profile of ['readable', 'ircam', 'phonetic']) {
  console.log(profile.padEnd(9), toArabic('ⵉⴼⴰⵙⵙⵏ ⴰⴳⴳⵯⴰ ⵜⴰⵎⴻⵣⴳⵉⴷⴰ ⴰⵡⴰⵍ', { profile }))
}

// 4. Diagnostics, alternatives and trace
const r = transliterate('ⵉⴳⵔ ⵯ', { alternatives: true, trace: true })
console.log(r.output, r.warnings.map((w) => w.code))
console.log(r.alternatives[0].alternatives.slice(0, 4))
console.log(r.trace[0])

// 5. Individual options on top of a profile
console.log(toArabic('ⴰⵔⴳⴰⵣ ⵉⵎⵉ', { arabic: { initialVowels: 'hamza-alef', g: 'kaf' } })) // أركاز إيمي

// 6. A reusable converter with a (validated, provenance-tagged) lexicon
const lexicon = new Lexicon([{ tifinagh: 'ⴰⴳⴰⴷⵉⵔ', arabic: 'أكادير', status: 'verified', source: 'official Arabic name of the city' }])
const conv = createConverter({ profile: 'readable', lexicon })
console.log(conv.convert('ⴰⴳⴰⴷⵉⵔ ⵜⴰⵎⴰⵣⵉⵖⵜ').output) // أكادير تامازيغت
