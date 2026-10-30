import { AR } from '../alphabet/arabic'
import type { LetterClass } from '../alphabet/inventory'
import type { SourceId } from '../alphabet/sources'
import type { ArabicOptions, ProfileId } from '../types/index'

/** Context of a unit inside its word, as seen by rule conditions. */
export type PrevContext = LetterClass | 'boundary' | 'other'

/**
 * Declarative condition. Every listed field must match.
 *  - letters:  Tifinagh base letters the rule applies to
 *  - classes:  letter classes the rule applies to
 *  - prev:     class of the previous *letter* in the word ('boundary' = word start)
 *  - options:  profile option values required
 */
export interface Condition {
  letters?: readonly string[]
  classes?: readonly LetterClass[]
  prev?: readonly PrevContext[]
  options?: Partial<ArabicOptions>
}

/**
 * Action of a letter-stage rule.
 *  - emit: write exactly this text for the letter
 *  - base: write the base correspondence (alphabet/arabic.ts) for the letter
 */
export type Action = { type: 'emit'; text: string } | { type: 'base' }

export interface Rule {
  id: string
  description: string
  /** Higher priority wins; ties are impossible by construction (tested). */
  priority: number
  when: Condition
  action: Action
  sources: SourceId[]
  /** documented = stated in a source; derived = follows from a source; heuristic = project proposal. */
  status: 'documented' | 'derived' | 'heuristic'
  /** Executable examples; the test-suite checks each of them. */
  examples: ReadonlyArray<{ profile: ProfileId; input: string; output: string }>
}

const A = 'ⴰ'
const I = 'ⵉ'
const U = 'ⵓ'
const Y = 'ⵢ'

/**
 * Letter-stage rules: choose the Arabic letter(s) for each unit.
 * Modifier-stage behaviour (gemination, labialization, schwa marks) is
 * described by MODIFIER_RULES and implemented in engine.ts.
 */
export const LETTER_RULES: readonly Rule[] = [
  // ── Word-initial vowels ────────────────────────────────────────────────────
  {
    id: 'vowel.initial.hamza-seat.i',
    description: 'Word-initial ⵉ is written ئ (hamza on a yeh seat), without a following ي.',
    priority: 100,
    when: { letters: [I], prev: ['boundary'], options: { initialVowels: 'hamza-seat' } },
    action: { type: 'emit', text: AR.YEH_HAMZA },
    sources: ['IRCAM-T2', 'WIKIDATA-SHI'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'ⵉⴼⴰⵙⵙⵏ', output: 'ئفاسّن' },
      { profile: 'ircam', input: 'ⵉⵎⵉ', output: 'ئمي' },
    ],
  },
  {
    id: 'vowel.initial.hamza-seat.u',
    description: 'Word-initial ⵓ is written ؤ (hamza on a waw seat).',
    priority: 100,
    when: { letters: [U], prev: ['boundary'], options: { initialVowels: 'hamza-seat' } },
    action: { type: 'emit', text: AR.WAW_HAMZA },
    sources: ['IRCAM-T2', 'WIKIDATA-SHI'],
    status: 'documented',
    examples: [{ profile: 'readable', input: 'ⵓⴽⵙⵓⵎ', output: 'ؤكسوم' }],
  },
  {
    id: 'vowel.initial.hamza-seat.a',
    description: 'Word-initial ⴰ is written with a bare alef ا (no hamza).',
    priority: 100,
    when: { letters: [A], prev: ['boundary'], options: { initialVowels: 'hamza-seat' } },
    action: { type: 'emit', text: AR.ALEF },
    sources: ['IRCAM-T1', 'WIKIDATA-SHI'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'ⴰⵣⵓⵍ', output: 'ازول' },
      { profile: 'readable', input: 'ⴰⴼⵓⵙ', output: 'افوس' },
    ],
  },
  {
    id: 'vowel.initial.alef.i',
    description: 'Option initialVowels=alef: word-initial ⵉ is written اي.',
    priority: 100,
    when: { letters: [I], prev: ['boundary'], options: { initialVowels: 'alef' } },
    action: { type: 'emit', text: AR.ALEF + AR.YEH },
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [],
  },
  {
    id: 'vowel.initial.alef.u',
    description: 'Option initialVowels=alef: word-initial ⵓ is written او.',
    priority: 100,
    when: { letters: [U], prev: ['boundary'], options: { initialVowels: 'alef' } },
    action: { type: 'emit', text: AR.ALEF + AR.WAW },
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [],
  },
  {
    id: 'vowel.initial.alef.a',
    description: 'Option initialVowels=alef: word-initial ⴰ is written ا.',
    priority: 100,
    when: { letters: [A], prev: ['boundary'], options: { initialVowels: 'alef' } },
    action: { type: 'emit', text: AR.ALEF },
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [],
  },
  {
    id: 'vowel.initial.hamza-alef.i',
    description: 'Option initialVowels=hamza-alef: word-initial ⵉ is written إي (common Arabic-orthography practice).',
    priority: 100,
    when: { letters: [I], prev: ['boundary'], options: { initialVowels: 'hamza-alef' } },
    action: { type: 'emit', text: AR.ALEF_HAMZA_BELOW + AR.YEH },
    sources: ['ALBANE-2025'],
    status: 'documented',
    examples: [],
  },
  {
    id: 'vowel.initial.hamza-alef.u',
    description: 'Option initialVowels=hamza-alef: word-initial ⵓ is written أو.',
    priority: 100,
    when: { letters: [U], prev: ['boundary'], options: { initialVowels: 'hamza-alef' } },
    action: { type: 'emit', text: AR.ALEF_HAMZA_ABOVE + AR.WAW },
    sources: ['ALBANE-2025'],
    status: 'documented',
    examples: [],
  },
  {
    id: 'vowel.initial.hamza-alef.a',
    description: 'Option initialVowels=hamza-alef: word-initial ⴰ is written أ.',
    priority: 100,
    when: { letters: [A], prev: ['boundary'], options: { initialVowels: 'hamza-alef' } },
    action: { type: 'emit', text: AR.ALEF_HAMZA_ABOVE },
    sources: ['ALBANE-2025'],
    status: 'documented',
    examples: [],
  },
  // ── Vowel hiatus ───────────────────────────────────────────────────────────
  {
    id: 'vowel.hiatus.hamza-seat.i',
    description: 'ⵉ directly after another vowel starts a new syllable: written ئ (extends Table II’s syllable-initial logic).',
    priority: 90,
    when: { letters: [I], prev: ['vowel'], options: { hiatus: 'hamza-seat' } },
    action: { type: 'emit', text: AR.YEH_HAMZA },
    sources: ['IRCAM-T2', 'PROJECT'],
    status: 'derived',
    examples: [{ profile: 'readable', input: 'ⵜⴰⵉ', output: 'تائ' }],
  },
  {
    id: 'vowel.hiatus.hamza-seat.u',
    description: 'ⵓ directly after another vowel: written ؤ.',
    priority: 90,
    when: { letters: [U], prev: ['vowel'], options: { hiatus: 'hamza-seat' } },
    action: { type: 'emit', text: AR.WAW_HAMZA },
    sources: ['IRCAM-T2', 'PROJECT'],
    status: 'derived',
    examples: [{ profile: 'readable', input: 'ⵜⴰⵓ', output: 'تاؤ' }],
  },
  // ── Semivowels ─────────────────────────────────────────────────────────────
  {
    id: 'semivowel.initial.plain-y',
    description: 'Word-initial ⵢ is written plain ي even when semivowels are otherwise marked (initial ي cannot be the vowel, which is ئ).',
    priority: 80,
    when: { letters: [Y], prev: ['boundary'], options: { plainInitialY: true } },
    action: { type: 'emit', text: AR.YEH },
    sources: ['IRCAM-T2'],
    status: 'documented',
    examples: [{ profile: 'ircam', input: 'ⵢⴰⵏ', output: 'يان' }],
  },
  // ── Defaults ───────────────────────────────────────────────────────────────
  {
    id: 'letter.base',
    description: 'Any other letter: the base correspondence of IRCAM Table I/II under the active options.',
    priority: 0,
    when: { classes: ['vowel', 'semivowel', 'consonant'] },
    action: { type: 'base' },
    sources: ['IRCAM-T1', 'IRCAM-T2'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', output: 'تامازيغت' },
      { profile: 'readable', input: 'ⴰⵎⵖⴰⵔ', output: 'امغار' },
      { profile: 'readable', input: 'ⴱⵔⴰⵢⵔ', output: 'براير' },
    ],
  },
  {
    id: 'schwa.letter',
    description: 'The neutral vowel ⴻ has no Arabic letter (Table I cell is empty); see modifier rules for its optional mark.',
    priority: 0,
    when: { classes: ['schwa'] },
    action: { type: 'emit', text: '' },
    sources: ['IRCAM-T1'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'ⵜⴰⵎⴻⵣⴳⵉⴷⴰ', output: 'تامزڭيدا' },
      { profile: 'phonetic', input: 'ⵜⴰⵎⴻⵣⴳⵉⴷⴰ', output: 'تامِزڭيدا' },
    ],
  },
]

export interface ModifierRule {
  id: string
  description: string
  sources: SourceId[]
  status: 'documented' | 'derived' | 'heuristic'
  examples: ReadonlyArray<{ profile: ProfileId; input: string; output: string; options?: Partial<ArabicOptions> }>
}

/** Modifier-stage rules (applied after the letter is chosen). */
export const MODIFIER_RULES: readonly ModifierRule[] = [
  {
    id: 'gemination.shadda',
    description: 'A geminate consonant (same letter repeated) is written once with shadda ّ.',
    sources: ['WIKIDATA-SHI', 'IRCAM-RULES', 'ALBANE-2025'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'ⵉⴼⴰⵙⵙⵏ', output: 'ئفاسّن' },
      { profile: 'readable', input: 'ⴰⴳⴳⵯⴰ', output: 'اڭُّا' },
    ],
  },
  {
    id: 'gemination.double',
    description: 'A geminate consonant is written by repeating the Arabic letter as often as the Tifinagh letter (letter-by-letter Table I).',
    sources: ['IRCAM-T1'],
    status: 'derived',
    examples: [{ profile: 'ircam', input: 'ⵉⴼⴰⵙⵙⵏ', output: 'ئفاسسن' }],
  },
  {
    id: 'gemination.single',
    description: 'A geminate consonant is written once, without shadda (unvocalized style; lossy).',
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [{ profile: 'readable', input: 'ⵉⴼⴰⵙⵙⵏ', output: 'ئفاسن', options: { gemination: 'single' } }],
  },
  {
    id: 'labialization.damma',
    description: 'Labialization ⵯ is written as damma ُ on the consonant (Table II).',
    sources: ['IRCAM-T2'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'ⴰⴽⵯⵉ', output: 'اكُي' },
      { profile: 'ircam', input: 'ⴰⴳⴳⵯⴰ', output: 'اڭڭُا' },
    ],
  },
  {
    id: 'labialization.ircam-table1',
    description: 'Labialization written with the quote mark ‘ (U+2018) after the consonant, as in Table I (breaks Arabic joining).',
    sources: ['IRCAM-T1'],
    status: 'documented',
    examples: [{ profile: 'ircam', input: 'ⴰⴽⵯⵉ', output: 'اك‘ي', options: { labialization: 'ircam-table1' } }],
  },
  {
    id: 'labialization.omit',
    description: 'Labialization not written (lossy).',
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [{ profile: 'readable', input: 'ⴰⴽⵯⵉ', output: 'اكي', options: { labialization: 'omit' } }],
  },
  {
    id: 'schwa.mark',
    description: 'Option schwa=kasra|fatha: the schwa is written as that short-vowel sign on the preceding consonant; after a vowel or word-initially, on an alef carrier.',
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [{ profile: 'phonetic', input: 'ⴰⵣⴻⵣ', output: 'ازِز' }],
  },
  {
    id: 'schwa.between-identical',
    description: 'A schwa between two identical consonants blocks gemination: the two letters stay separate (no shadda), so ⵣⴻⵣ ≠ ⵣⵣ.',
    sources: ['IRCAM-INVENTORY', 'PROJECT'],
    status: 'derived',
    examples: [
      { profile: 'readable', input: 'ⴰⵣⴻⵣ', output: 'ازز' },
      { profile: 'readable', input: 'ⴰⵣⵣ', output: 'ازّ' },
    ],
  },
  {
    id: 'mark.canonical-order',
    description: 'Combining marks on one letter are emitted in Unicode canonical order (e.g. damma before shadda), so the output is NFC-stable.',
    sources: ['UNICODE'],
    status: 'documented',
    examples: [],
  },
  {
    id: 'ta.final-no-marbuta',
    description: 'ⵜ is always ت, also word-finally; ة (ta marbuta) is never produced.',
    sources: ['IRCAM-T1'],
    status: 'documented',
    examples: [{ profile: 'readable', input: 'ⵜⴰⵎⵓⵔⵜ', output: 'تامورت' }],
  },
]

/** Precompiled lookup: rules sorted by priority (descending), stable. */
export const SORTED_LETTER_RULES: readonly Rule[] = LETTER_RULES.slice().sort((a, b) => b.priority - a.priority)
