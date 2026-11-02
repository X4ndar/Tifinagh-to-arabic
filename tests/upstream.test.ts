// Tests inherited from upstream hamza-bouqssim/tifinagh-convert @ 1f0f31a (MIT).
// Two expectations changed on purpose (documented in docs/architecture.md §Compatibility):
//  - empty input now returns empty output instead of throwing;
//  - Tifinagh → Arabic is now implemented instead of throwing "not yet supported".
import { convert, detect, alphabet } from '../src/index'

// ─── Tifinagh → Latin ────────────────────────────────────────────────────────

describe('tifinaghToLatin', () => {
  test('converts basic word', () => {
    const r = convert('\u2D4E\u2D53\u2D54', { from: 'tifinagh', to: 'latin' })
    expect(r.output).toBe('mur')
    expect(r.warnings).toHaveLength(0)
  })

  test('converts vowels', () => {
    const r = convert('\u2D30\u2D49\u2D53\u2D3B', { from: 'tifinagh', to: 'latin' })
    expect(r.output).toBe('aiue')
    expect(r.warnings).toHaveLength(0)
  })

  test('handles labialized consonant (2 codepoints → 1 sound)', () => {
    // kʷ = U+2D3D + U+2D6F, then a=U+2D30, l=U+2D4D
    const r = convert('\u2D3D\u2D6F\u2D30\u2D4D', { from: 'tifinagh', to: 'latin' })
    expect(r.output).toBe('k\u02B7al')
    expect(r.warnings).toHaveLength(0)
  })

  test('passes through whitespace unchanged', () => {
    const r = convert('\u2D4E\u2D53\u2D54 \u2D30\u2D4D', { from: 'tifinagh', to: 'latin' })
    expect(r.output).toContain(' ')
    expect(r.warnings).toHaveLength(0)
  })

  test('warns on unknown character but converts the rest', () => {
    const r = convert('\u2D4E\u2605\u2D54', { from: 'tifinagh', to: 'latin' })
    expect(r.output).toBe('m\u2605r')
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0].code).toBe('UNKNOWN_CHAR')
    expect(r.warnings[0].position).toBe(1)
  })

  test('returns correct metadata', () => {
    const r = convert('\u2D4E\u2D53\u2D54', { from: 'tifinagh', to: 'latin' })
    expect(r.from).toBe('tifinagh')
    expect(r.to).toBe('latin')
    expect(r.detected).toBe(false)
    expect(r.region).toBe('morocco')
  })
})

// ─── Latin → Tifinagh ────────────────────────────────────────────────────────

describe('latinToTifinagh', () => {
  test('converts basic word', () => {
    const r = convert('mur', { from: 'latin', to: 'tifinagh' })
    expect(r.output).toBe('\u2D4E\u2D53\u2D54')
    expect(r.warnings).toHaveLength(0)
  })

  test('converts tamurt', () => {
    const r = convert('tamurt', { from: 'latin', to: 'tifinagh' })
    expect(r.output).toBe('\u2D5C\u2D30\u2D4E\u2D53\u2D54\u2D5C')
    expect(r.warnings).toHaveLength(0)
  })

  test('gh converts to ⵖ without warning', () => {
  const r = convert('agham', { from: 'latin', to: 'tifinagh' })
  expect(r.warnings).toHaveLength(0)
  expect(r.output).toBe('\u2D30\u2D56\u2D30\u2D4E')
})

  test('no warning when middle dot used to disambiguate', () => {
    // ag·ham: g then h separately, not the digraph gh
    const r = convert('ag\u00B7ham', { from: 'latin', to: 'tifinagh' })
    expect(r.warnings).toHaveLength(0)
  })

  test('ch converts to ⵛ without warning', () => {
  const r = convert('ach', { from: 'latin', to: 'tifinagh' })
  expect(r.warnings).toHaveLength(0)
  expect(r.output).toBe('\u2D30\u2D5B')
})

  test('uppercase D converts to emphatic ⴹ (ḍ), not plain ⴷ', () => {
    const r = convert('abaD', { from: 'latin', to: 'tifinagh' })
    expect(r.output).toBe('ⴰⴱⴰⴹ')
    expect(r.warnings).toHaveLength(0)
  })

  test('warns on unknown Latin character', () => {
    const r = convert('m@r', { from: 'latin', to: 'tifinagh' })
    expect(r.output).toBe('\u2D4E@\u2D54')
    expect(r.warnings[0].code).toBe('UNKNOWN_CHAR')
  })
})

// ─── Auto-detect ─────────────────────────────────────────────────────────────

describe('auto-detect (no from param)', () => {
  test('detects tifinagh and converts to latin', () => {
    const r = convert('\u2D4E\u2D53\u2D54', { to: 'latin' })
    expect(r.detected).toBe(true)
    expect(r.from).toBe('tifinagh')
    expect(r.output).toBe('mur')
  })

  test('detects latin and converts to tifinagh', () => {
    const r = convert('mur', { to: 'tifinagh' })
    expect(r.detected).toBe(true)
    expect(r.from).toBe('latin')
    expect(r.output).toBe('\u2D4E\u2D53\u2D54')
  })
})

// ─── detect() ────────────────────────────────────────────────────────────────

describe('detect()', () => {
  test('detects tifinagh', () => {
    const r = detect('\u2D4E\u2D53\u2D54')
    expect(r.script).toBe('tifinagh')
    expect(r.confidence).toBeGreaterThan(0.9)
  })

  test('detects latin', () => {
    const r = detect('tamurt')
    expect(r.script).toBe('latin')
    expect(r.confidence).toBeGreaterThan(0.9)
  })

  test('detects arabic', () => {
    const r = detect('\u0645\u0631\u0627\u0643\u0634')
    expect(r.script).toBe('arabic')
    expect(r.confidence).toBeGreaterThan(0.9)
  })
})

// ─── alphabet() ──────────────────────────────────────────────────────────────

describe('alphabet()', () => {
  test('returns entries by default', () => {
    const entries = alphabet()
    expect(entries.length).toBeGreaterThan(20)
  })

  test('filters vowels correctly', () => {
    const vowels = alphabet({ type: 'vowel' })
    expect(vowels.every(e => e.type === 'vowel')).toBe(true)
    expect(vowels.length).toBe(4)
  })

  test('excludes Algeria-only letter in morocco mode', () => {
    const entries = alphabet({ region: 'morocco' })
    expect(entries.find(e => e.unicode === '2D35')).toBeUndefined()
  })

  test('includes Algeria-only letter in algeria mode', () => {
    const entries = alphabet({ region: 'algeria' })
    expect(entries.find(e => e.unicode === '2D35')).toBeDefined()
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  test('empty string returns empty output (changed from upstream, which threw)', () => {
    expect(convert('', { from: 'tifinagh', to: 'latin' }).output).toBe('')
    expect(convert('', { to: 'arabic' }).output).toBe('')
  })

  test('throws on non-string input', () => {
    expect(() => convert(undefined as unknown as string, { to: 'latin' })).toThrow(TypeError)
  })

  test('throws when from === to', () => {
    expect(() => convert('\u2D4E\u2D53\u2D54', { from: 'tifinagh', to: 'tifinagh' })).toThrow()
  })

  test('tifinagh → arabic is supported (upstream threw "not yet supported")', () => {
    expect(convert('\u2D4E\u2D53\u2D54', { from: 'tifinagh', to: 'arabic' }).output).toBe('مور')
  })

  test('arabic as a source script is supported (it threw before)', () => {
    expect(convert('\u0645\u0648\u0631', { from: 'arabic', to: 'tifinagh' }).output).toBe('ⵎⵓⵔ')
    expect(convert('\u0645\u0648\u0631', { from: 'arabic', to: 'latin' }).output).toBe('mur')
  })
})
