import type { CharEntry } from '../types/index'

/**
 * Authoritative Tifinagh ↔ Latin mapping.
 * Sources:
 *  - ALA-LC Tamazight Romanization (Library of Congress)
 *  - BGN/PCGN Romanization of Neo-Tifinagh (UK Government, 2022)
 *  - Unicode Tifinagh block U+2D30–U+2D7F
 */
export const MAPPING: CharEntry[] = [
  // ─── Vowels ──────────────────────────────────────────────────────────────
  { tifinagh: '\u2D30', unicode: '2D30', latin: 'a',  type: 'vowel' },
  { tifinagh: '\u2D3B', unicode: '2D3B', latin: 'e',  type: 'vowel' },
  { tifinagh: '\u2D49', unicode: '2D49', latin: 'i',  type: 'vowel' },
  { tifinagh: '\u2D53', unicode: '2D53', latin: 'u',  type: 'vowel' },

  // ─── Consonants ───────────────────────────────────────────────────────────
  { tifinagh: '\u2D31', unicode: '2D31', latin: 'b',  type: 'consonant' },
  { tifinagh: '\u2D33', unicode: '2D33', latin: 'g',  type: 'consonant' },
  { tifinagh: '\u2D33\u2D6F', unicode: '2D33+2D6F', latin: 'g\u02B7', type: 'consonant', note: 'labialized g' },
  { tifinagh: '\u2D37', unicode: '2D37', latin: 'd',  type: 'consonant' },
  { tifinagh: '\u2D39', unicode: '2D39', latin: '\u1E0D', type: 'consonant' },
  { tifinagh: '\u2D3C', unicode: '2D3C', latin: 'f',  type: 'consonant' },
  { tifinagh: '\u2D3D', unicode: '2D3D', latin: 'k',  type: 'consonant' },
  { tifinagh: '\u2D3D\u2D6F', unicode: '2D3D+2D6F', latin: 'k\u02B7', type: 'consonant', note: 'labialized k' },
  { tifinagh: '\u2D40', unicode: '2D40', latin: 'h',  type: 'consonant' },
  { tifinagh: '\u2D43', unicode: '2D43', latin: '\u1E25', type: 'consonant' },
  { tifinagh: '\u2D44', unicode: '2D44', latin: '\u025B', type: 'consonant', note: 'ayin (\u025B)' },
  { tifinagh: '\u2D45', unicode: '2D45', latin: 'x',  type: 'consonant' },
  { tifinagh: '\u2D47', unicode: '2D47', latin: 'q',  type: 'consonant' },
  { tifinagh: '\u2D4A', unicode: '2D4A', latin: 'j',  type: 'consonant' },
  { tifinagh: '\u2D4D', unicode: '2D4D', latin: 'l',  type: 'consonant' },
  { tifinagh: '\u2D4E', unicode: '2D4E', latin: 'm',  type: 'consonant' },
  { tifinagh: '\u2D4F', unicode: '2D4F', latin: 'n',  type: 'consonant' },
  { tifinagh: '\u2D54', unicode: '2D54', latin: 'r',  type: 'consonant' },
  { tifinagh: '\u2D55', unicode: '2D55', latin: '\u1E5B', type: 'consonant' },
  { tifinagh: '\u2D56', unicode: '2D56', latin: '\u0263', type: 'consonant', note: 'ɣ (voiced velar fricative)' },
  { tifinagh: '\u2D59', unicode: '2D59', latin: 's',  type: 'consonant' },
  { tifinagh: '\u2D5A', unicode: '2D5A', latin: '\u1E63', type: 'consonant' },
  { tifinagh: '\u2D5B', unicode: '2D5B', latin: 'ch', type: 'consonant', note: 'digraph' },
  { tifinagh: '\u2D5C', unicode: '2D5C', latin: 't',  type: 'consonant' },
  { tifinagh: '\u2D5F', unicode: '2D5F', latin: '\u1E6D', type: 'consonant' },
  { tifinagh: '\u2D61', unicode: '2D61', latin: 'w',  type: 'consonant' },
  { tifinagh: '\u2D62', unicode: '2D62', latin: 'y',  type: 'consonant' },
  { tifinagh: '\u2D63', unicode: '2D63', latin: 'z',  type: 'consonant' },
  { tifinagh: '\u2D65', unicode: '2D65', latin: '\u1E93', type: 'consonant' },

  // ─── Algeria-only ─────────────────────────────────────────────────────────
  { tifinagh: '\u2D35', unicode: '2D35', latin: '\u01E7', type: 'consonant', region: 'algeria', note: 'Algeria only' },

  // ─── Modifier ─────────────────────────────────────────────────────────────
  { tifinagh: '\u2D6F', unicode: '2D6F', latin: '\u02B7', type: 'modifier', note: 'tamatart — labialization mark' },
]

/**
 * Tifinagh → Latin lookup (longest match first for labialized pairs)
 */
export const TIFINAGH_TO_LATIN: Map<string, string> = new Map(
  [...MAPPING]
    .filter(e => e.type !== 'modifier')
    .sort((a, b) => b.tifinagh.length - a.tifinagh.length)
    .map(e => [e.tifinagh, e.latin])
)

/**
 * Latin → Tifinagh lookup (longest match first for digraphs)
 */
export const LATIN_TO_TIFINAGH: Map<string, string> = new Map(
  [...MAPPING]
    .filter(e => e.type !== 'modifier')
    .sort((a, b) => b.latin.length - a.latin.length)
    .map(e => [e.latin, e.tifinagh])
)
