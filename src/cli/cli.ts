import * as fs from 'fs'
import { StringDecoder } from 'string_decoder'
import { ArabicConverter } from '../core/arabic'
import { tifinaghToLatin } from '../converters/tifinaghToLatin'
import { latinToTifinagh } from '../converters/latinToTifinagh'
import { TransliterationError } from '../diagnostics/diagnostics'
import { Lexicon } from '../lexicon/lexicon'
import { OPTION_VALUES, PROFILES } from '../profiles/profiles'
import type { SegmentState } from '../tokenization/segment'
import type { ArabicOptions, ConversionWarning, ProfileId } from '../types/index'

export const EXIT = { OK: 0, USAGE: 1, IO: 2, STRICT: 3 } as const

export interface CliIO {
  stdin: NodeJS.ReadableStream
  stdout: NodeJS.WritableStream
  stderr: NodeJS.WritableStream
}

interface CliArgs {
  from: 'tifinagh' | 'latin'
  to: 'arabic' | 'latin' | 'tifinagh'
  profile: ProfileId
  overrides: Partial<ArabicOptions>
  text?: string
  inputs: string[]
  output?: string
  json: boolean
  jsonl: boolean
  diagnostics: boolean
  strict: boolean
  alternatives: boolean
  trace: boolean
  lexicon?: string
  allowProvisional: boolean
  maxBytes: number
  help: boolean
  version: boolean
  listProfiles: boolean
}

export const HELP = `amazigh-transliterate — Tifinagh → Arabic-script (and Latin) transliteration for Moroccan Amazigh

Usage:
  amazigh-transliterate [options] --text "ⴰⵣⵓⵍ"
  amazigh-transliterate [options] [FILE ...]          (UTF-8 files; '-' or none = stdin)

Options:
  --from tifinagh|latin        Source script (default: tifinagh)
  --to arabic|latin|tifinagh   Target script (default: arabic)
  --profile readable|ircam|phonetic
                               Arabic conversion profile (default: readable)
  --option KEY=VALUE           Override one Arabic option (repeatable), e.g. --option gemination=double
  --text STRING                Convert STRING instead of reading files/stdin
  -o, --output FILE            Write output to FILE (default: stdout)
  --json                       Emit one JSON document {output, profile, warnings, ...}
  --jsonl                      Batch mode: each input line is JSON {"id"?, "text"}; each output line is
                               JSON {"id", "output", "warnings"[, "alternatives", "trace"]}
  --diagnostics                In plain-text mode, also write warnings to stderr as JSON lines
  --strict                     Fail (exit code 3) on unsupported/malformed Tifinagh
  --alternatives               Include alternative spellings (JSON modes)
  --trace                      Include the rule trace (JSON modes)
  --lexicon FILE               JSON lexicon of validated overrides (see docs/architecture.md)
  --allow-provisional          Let provisional lexicon entries override rules
  --max-bytes N                Refuse inputs larger than N bytes (default: unlimited when streaming,
                               256 MiB for --json)
  --list-profiles              Print the profiles and their options as JSON
  -h, --help                   Show this help
  -v, --version                Show version

Exit codes: 0 ok · 1 usage error · 2 I/O error · 3 strict-mode failure
Plain-text mode streams line by line and preserves line breaks and blank lines exactly.`

class UsageError extends Error {}

function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = {
    from: 'tifinagh',
    to: 'arabic',
    profile: 'readable',
    overrides: {},
    inputs: [],
    json: false,
    jsonl: false,
    diagnostics: false,
    strict: false,
    alternatives: false,
    trace: false,
    allowProvisional: false,
    maxBytes: 0,
    help: false,
    version: false,
    listProfiles: false,
  }
  const need = (i: number, flag: string): string => {
    if (i >= argv.length) throw new UsageError(`Missing value for ${flag}`)
    return argv[i]
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    let flag = arg
    let inline: string | undefined
    if (arg.startsWith('--') && arg.includes('=')) {
      flag = arg.slice(0, arg.indexOf('='))
      inline = arg.slice(arg.indexOf('=') + 1)
    }
    const value = (): string => (inline !== undefined ? inline : need(++i, flag))
    switch (flag) {
      case '--from': {
        const v = value()
        if (v !== 'tifinagh' && v !== 'latin') throw new UsageError(`--from must be tifinagh or latin (got '${v}')`)
        a.from = v
        break
      }
      case '--to': {
        const v = value()
        if (v !== 'arabic' && v !== 'latin' && v !== 'tifinagh') throw new UsageError(`--to must be arabic, latin or tifinagh (got '${v}')`)
        a.to = v
        break
      }
      case '--profile': {
        const v = value()
        if (!(v in PROFILES)) throw new UsageError(`--profile must be one of ${Object.keys(PROFILES).join(', ')} (got '${v}')`)
        a.profile = v as ProfileId
        break
      }
      case '--option': {
        const v = value()
        const eq = v.indexOf('=')
        if (eq < 1) throw new UsageError(`--option expects KEY=VALUE (got '${v}')`)
        const key = v.slice(0, eq) as keyof ArabicOptions
        const raw = v.slice(eq + 1)
        if (!(key in OPTION_VALUES)) throw new UsageError(`Unknown option '${key}'. Known: ${Object.keys(OPTION_VALUES).join(', ')}`)
        const parsed: unknown = raw === 'true' ? true : raw === 'false' ? false : raw
        if (!(OPTION_VALUES[key] as readonly unknown[]).includes(parsed)) {
          throw new UsageError(`Invalid value '${raw}' for ${key}. Allowed: ${(OPTION_VALUES[key] as readonly unknown[]).join(', ')}`)
        }
        ;(a.overrides as Record<string, unknown>)[key] = parsed
        break
      }
      case '--text':
        a.text = value()
        break
      case '-o':
      case '--output':
        a.output = value()
        break
      case '--json':
        a.json = true
        break
      case '--jsonl':
        a.jsonl = true
        break
      case '--diagnostics':
        a.diagnostics = true
        break
      case '--strict':
        a.strict = true
        break
      case '--alternatives':
        a.alternatives = true
        break
      case '--trace':
        a.trace = true
        break
      case '--lexicon':
        a.lexicon = value()
        break
      case '--allow-provisional':
        a.allowProvisional = true
        break
      case '--max-bytes': {
        const v = Number(value())
        if (!Number.isInteger(v) || v <= 0) throw new UsageError('--max-bytes expects a positive integer')
        a.maxBytes = v
        break
      }
      case '--list-profiles':
        a.listProfiles = true
        break
      case '-h':
      case '--help':
        a.help = true
        break
      case '-v':
      case '--version':
        a.version = true
        break
      default:
        if (arg.startsWith('-') && arg !== '-') throw new UsageError(`Unknown option '${arg}' (see --help)`)
        a.inputs.push(arg)
    }
  }
  if (a.from === a.to) throw new UsageError(`--from and --to cannot both be '${a.from}'`)
  if (a.json && a.jsonl) throw new UsageError('--json and --jsonl are mutually exclusive')
  if (a.to !== 'arabic' && (a.alternatives || a.trace || a.lexicon || a.strict)) {
    throw new UsageError('--alternatives, --trace, --lexicon and --strict apply to --to arabic only')
  }
  return a
}

/** Output streams whose reader has gone away (e.g. `amazigh-transliterate big.txt | head`). */
const closedStreams = new WeakSet<NodeJS.WritableStream>()
const isPipeClosed = (e: unknown): boolean => {
  const code = (e as { code?: string } | null)?.code
  return code === 'EPIPE' || code === 'ERR_STREAM_DESTROYED' || code === 'ERR_STREAM_WRITE_AFTER_END'
}

/** Stop quietly, like other command-line tools, when the reader of a stream goes away. */
function watchPipe(stream: NodeJS.WritableStream): void {
  stream.on('error', (e: unknown) => {
    if (isPipeClosed(e)) closedStreams.add(stream)
  })
}

function write(stream: NodeJS.WritableStream, s: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (closedStreams.has(stream) || (stream as { destroyed?: boolean }).destroyed) {
      closedStreams.add(stream)
      return resolve()
    }
    const ok = stream.write(s, (err) => {
      if (!err) return
      if (isPipeClosed(err)) {
        closedStreams.add(stream)
        resolve()
      } else reject(err)
    })
    if (ok) resolve()
    else {
      stream.once('drain', () => resolve())
      stream.once('close', () => resolve())
    }
  })
}

/** Iterate over the lines of a stream, keeping the exact line terminator. */
async function* lines(stream: NodeJS.ReadableStream, maxBytes: number): AsyncGenerator<{ line: string; eol: string }> {
  let buf = ''
  let total = 0
  const decoder = new StringDecoder('utf8')
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    const b = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
    total += b.length
    if (maxBytes > 0 && total > maxBytes) throw new UsageError(`Input exceeds --max-bytes (${maxBytes})`)
    buf += decoder.write(b)
    let nl = buf.indexOf('\n')
    let consumed = 0
    while (nl >= 0) {
      yield { line: buf.slice(consumed, nl), eol: '\n' }
      consumed = nl + 1
      nl = buf.indexOf('\n', consumed)
    }
    buf = buf.slice(consumed)
  }
  buf += decoder.end()
  if (buf.length > 0) yield { line: buf, eol: '' }
}

async function readAll(stream: NodeJS.ReadableStream, maxBytes: number): Promise<string> {
  let out = ''
  for await (const { line, eol } of lines(stream, maxBytes)) out += line + eol
  return out
}

function openInputs(a: CliArgs, io: CliIO): NodeJS.ReadableStream[] {
  if (a.inputs.length === 0) return [io.stdin]
  return a.inputs.map((f) => {
    if (f === '-') return io.stdin
    try {
      // regular files, but also pipes and devices (`<(cmd)`, /dev/stdin); only directories are refused
      if (fs.statSync(f).isDirectory()) throw new Error('it is a directory')
    } catch (e) {
      throw Object.assign(new Error(`Cannot read input file '${f}': ${(e as Error).message}`), { io: true })
    }
    return fs.createReadStream(f)
  })
}

function versionString(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('../../package.json') as { version: string }).version
  } catch {
    return 'unknown'
  }
}

/** Run the CLI. Returns the exit code (never calls process.exit). */
export async function main(argv: string[], io: CliIO): Promise<number> {
  watchPipe(io.stdout)
  watchPipe(io.stderr)
  let a: CliArgs
  try {
    a = parseArgs(argv)
  } catch (e) {
    await write(io.stderr, `error: ${(e as Error).message}\n`)
    return EXIT.USAGE
  }
  if (a.help) {
    await write(io.stdout, HELP + '\n')
    return EXIT.OK
  }
  if (a.version) {
    await write(io.stdout, versionString() + '\n')
    return EXIT.OK
  }
  if (a.listProfiles) {
    await write(io.stdout, JSON.stringify(PROFILES, null, 2) + '\n')
    return EXIT.OK
  }

  let lexicon: Lexicon | null = null
  if (a.lexicon) {
    try {
      const st = fs.statSync(a.lexicon)
      if (st.size > 64 * 1024 * 1024) throw new Error('lexicon file larger than 64 MiB')
      lexicon = Lexicon.fromJSON(fs.readFileSync(a.lexicon, 'utf8'), { allowProvisional: a.allowProvisional })
      const words = new Set(lexicon.conflicts().map((c) => c.tifinagh)).size
      if (words > 0) {
        await write(io.stderr, `warning: lexicon has conflicting spellings for ${words} word${words === 1 ? '' : 's'}; those words keep the rule output\n`)
      }
    } catch (e) {
      await write(io.stderr, `error: cannot load lexicon '${a.lexicon}': ${(e as Error).message}\n`)
      return EXIT.IO
    }
  }

  let converter: ArabicConverter | null = null
  if (a.to === 'arabic') {
    try {
      converter = new ArabicConverter({
        profile: a.profile,
        arabic: a.overrides,
        strict: a.strict,
        alternatives: a.alternatives,
        trace: a.trace,
        lexicon,
      })
    } catch (e) {
      await write(io.stderr, `error: ${(e as Error).message}\n`)
      return EXIT.USAGE
    }
  }

  const convertPlain = (text: string, state: SegmentState, offset: number): { output: string; warnings: ConversionWarning[]; extra: Record<string, unknown> } => {
    if (converter) {
      const r = a.from === 'latin' ? converter.convertChunk(latinToTifinagh(text).output, state, offset) : converter.convertChunk(text, state, offset)
      const extra: Record<string, unknown> = {}
      if (r.alternatives) extra.alternatives = r.alternatives
      if (r.trace) extra.trace = r.trace
      return { output: r.output, warnings: r.warnings, extra }
    }
    const r = a.to === 'latin' ? tifinaghToLatin(text) : latinToTifinagh(text)
    return { output: r.output, warnings: r.warnings, extra: {} }
  }

  let out: NodeJS.WritableStream = io.stdout
  let fileOut: fs.WriteStream | null = null
  try {
    if (a.output) {
      fileOut = fs.createWriteStream(a.output, { encoding: 'utf8' })
      await new Promise<void>((resolve, reject) => {
        fileOut!.once('open', () => resolve())
        fileOut!.once('error', reject)
      })
      out = fileOut
    }

    // ── --text ───────────────────────────────────────────────────────────
    if (a.text !== undefined) {
      const r = convertPlain(a.text, { fence: null }, 0)
      if (a.json || a.jsonl) {
        await write(out, JSON.stringify({ output: r.output, from: a.from, to: a.to, profile: converter ? a.profile : undefined, warnings: r.warnings, ...r.extra }) + '\n')
      } else {
        await write(out, r.output + '\n')
        if (a.diagnostics) for (const w of r.warnings) await write(io.stderr, JSON.stringify(w) + '\n')
      }
      return EXIT.OK
    }

    const inputs = openInputs(a, io)

    // ── --json: whole input as one document ──────────────────────────────
    if (a.json) {
      let text = ''
      for (const s of inputs) text += await readAll(s, a.maxBytes || 256 * 1024 * 1024)
      const r = convertPlain(text, { fence: null }, 0)
      await write(out, JSON.stringify({ output: r.output, from: a.from, to: a.to, profile: converter ? a.profile : undefined, warnings: r.warnings, ...r.extra }) + '\n')
      return EXIT.OK
    }

    // ── --jsonl: batch records ───────────────────────────────────────────
    if (a.jsonl) {
      let n = 0
      let strictFailed = false
      for (const s of inputs) {
        for await (const { line } of lines(s, a.maxBytes)) {
          if (closedStreams.has(out)) return strictFailed ? EXIT.STRICT : EXIT.OK
          n++
          const raw = line.endsWith('\r') ? line.slice(0, -1) : line
          if (raw.trim() === '') continue
          let rec: { id?: unknown; text?: unknown }
          try {
            rec = JSON.parse(raw) as { id?: unknown; text?: unknown }
          } catch {
            await write(out, JSON.stringify({ line: n, error: 'invalid JSON' }) + '\n')
            continue
          }
          if (typeof rec !== 'object' || rec === null || typeof rec.text !== 'string') {
            await write(out, JSON.stringify({ id: (rec as { id?: unknown })?.id ?? null, line: n, error: "record must be an object with a string 'text'" }) + '\n')
            continue
          }
          try {
            const r = convertPlain(rec.text, { fence: null }, 0)
            await write(out, JSON.stringify({ id: rec.id ?? n, output: r.output, warnings: r.warnings, ...r.extra }) + '\n')
          } catch (e) {
            if (e instanceof TransliterationError) {
              await write(out, JSON.stringify({ id: rec.id ?? n, error: e.message, warnings: e.warnings }) + '\n')
              strictFailed = true
            } else throw e
          }
        }
      }
      return strictFailed ? EXIT.STRICT : EXIT.OK
    }

    // ── plain text: stream line by line ──────────────────────────────────
    const state: SegmentState = { fence: null }
    let offset = 0
    let pending = ''
    for (const s of inputs) {
      for await (const { line, eol } of lines(s, a.maxBytes)) {
        if (closedStreams.has(out)) return EXIT.OK // nobody is reading any more
        const r = convertPlain(line, state, offset)
        pending += r.output + eol
        // batch writes (64 KiB) — order with stderr diagnostics is kept by flushing first
        if (pending.length >= 65536 || (a.diagnostics && r.warnings.length > 0)) {
          await write(out, pending)
          pending = ''
        }
        if (a.diagnostics) for (const w of r.warnings) await write(io.stderr, JSON.stringify(w) + '\n')
        offset += line.length + eol.length
      }
    }
    if (pending) await write(out, pending)
    return EXIT.OK
  } catch (e) {
    if (e instanceof TransliterationError) {
      await write(io.stderr, `error: ${e.message}\n`)
      return EXIT.STRICT
    }
    if (e instanceof UsageError) {
      await write(io.stderr, `error: ${e.message}\n`)
      return EXIT.USAGE
    }
    await write(io.stderr, `error: ${(e as Error).message}\n`)
    return EXIT.IO
  } finally {
    if (fileOut) await new Promise<void>((resolve) => fileOut!.end(() => resolve()))
  }
}
