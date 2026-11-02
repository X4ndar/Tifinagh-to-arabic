/**
 * Small, dependency-free HTTP server: the web page (demo/) and a JSON API.
 * Built for self-hosting behind a reverse proxy (Coolify/Traefik, nginx, Caddy).
 *
 *   GET  /                      web page
 *   GET  /healthz               liveness / readiness probe
 *   GET  /api                   endpoint list
 *   GET  /api/version           package name and version
 *   GET  /api/profiles          profiles and their options (?from=arabic: Arabic → Tifinagh options)
 *   GET  /api/transliterate?text=…&profile=…
 *   POST /api/transliterate     {"text": "…"} or {"texts": ["…", …]} + options; "from": "arabic" for Arabic → Tifinagh
 */
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import * as zlib from 'zlib'
import { ArabicConverter } from '../core/arabic'
import { latinToTifinagh } from '../converters/latinToTifinagh'
import { tifinaghToLatin } from '../converters/tifinaghToLatin'
import { ArabicToTifinaghConverter, REVERSE_PROFILES, type ReverseOptions } from '../reverse/arabicToTifinagh'
import { TransliterationError } from '../diagnostics/diagnostics'
import { Lexicon } from '../lexicon/lexicon'
import { PROFILES } from '../profiles/profiles'
import type { ArabicOptions, ProfileId } from '../types/index'

export interface ServerConfig {
  /** Allowed CORS origin for the API ('*' for any, '' to send no CORS headers). */
  corsOrigin: string
  /** Requests per minute per client IP for /api (0 = unlimited). */
  rateLimitPerMinute: number
  /** Maximum request body in bytes. */
  maxBodyBytes: number
  /** Maximum characters per text. */
  maxTextChars: number
  /** Maximum number of texts in one batch request. */
  maxBatchItems: number
  /** Read the client IP from X-Forwarded-For (true when running behind a proxy such as Coolify's). */
  trustProxy: boolean
  /** Serve the web page at /. */
  uiEnabled: boolean
  /** Write one JSON line per request to stdout. */
  logRequests: boolean
  /** Profile used when a request does not name one. */
  defaultProfile: ProfileId
  /** Optional lexicon of validated overrides, loaded once at start. */
  lexicon: Lexicon | null
  /** Repository root (where demo/, dist/, docs/ live). */
  root: string
}

const ROOT = path.resolve(__dirname, '..', '..')

function envInt(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer (got '${raw}')`)
  return n
}
function envBool(name: string, fallback: boolean, env: NodeJS.ProcessEnv): boolean {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  if (/^(1|true|yes|on)$/i.test(raw)) return true
  if (/^(0|false|no|off)$/i.test(raw)) return false
  throw new Error(`${name} must be true or false (got '${raw}')`)
}

/** Read the configuration from environment variables (see docs/deploy.md). */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const profile = (env.DEFAULT_PROFILE || 'readable') as ProfileId
  if (!(profile in PROFILES)) throw new Error(`DEFAULT_PROFILE must be one of ${Object.keys(PROFILES).join(', ')}`)
  let lexicon: Lexicon | null = null
  if (env.LEXICON_PATH) {
    let raw: string
    try {
      raw = fs.readFileSync(env.LEXICON_PATH, 'utf8')
    } catch (e) {
      throw new Error(`LEXICON_PATH: cannot read '${env.LEXICON_PATH}' (${(e as NodeJS.ErrnoException).code ?? (e as Error).message})`)
    }
    try {
      lexicon = Lexicon.fromJSON(raw, { allowProvisional: envBool('LEXICON_ALLOW_PROVISIONAL', false, env) })
    } catch (e) {
      throw new Error(`LEXICON_PATH: '${env.LEXICON_PATH}' is not a valid lexicon: ${(e as Error).message}`)
    }
  }
  return {
    corsOrigin: env.CORS_ORIGIN ?? '*',
    rateLimitPerMinute: envInt('RATE_LIMIT_PER_MINUTE', 120, env),
    maxBodyBytes: envInt('MAX_BODY_BYTES', 1024 * 1024, env),
    maxTextChars: envInt('MAX_TEXT_CHARS', 200_000, env),
    maxBatchItems: envInt('MAX_BATCH_ITEMS', 1000, env),
    trustProxy: envBool('TRUST_PROXY', true, env),
    uiEnabled: envBool('UI_ENABLED', true, env),
    logRequests: envBool('LOG_REQUESTS', true, env),
    defaultProfile: profile,
    lexicon,
    root: env.APP_ROOT || ROOT,
  }
}

// ── Static files ─────────────────────────────────────────────────────────────

interface Asset {
  body: Buffer
  gzip: Buffer
  type: string
  cache: string
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

/** Load the page and its files once, at start (small: ~250 KB). */
function loadAssets(root: string): Map<string, Asset> {
  const assets = new Map<string, Asset>()
  const add = (url: string, file: string, cache: string): void => {
    if (!fs.existsSync(file)) return
    const body = fs.readFileSync(file)
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream'
    const compressible = !type.startsWith('font/')
    assets.set(url, { body, gzip: compressible ? zlib.gzipSync(body, { level: 9 }) : body, type, cache })
  }
  add('/', path.join(root, 'demo', 'index.html'), 'no-cache')
  add('/dist/browser/amazigh-transliterate.min.js', path.join(root, 'dist', 'browser', 'amazigh-transliterate.min.js'), 'no-cache')
  const fonts = path.join(root, 'demo', 'fonts')
  if (fs.existsSync(fonts)) {
    for (const f of fs.readdirSync(fonts)) add(`/fonts/${f}`, path.join(fonts, f), 'public, max-age=31536000, immutable')
  }
  add('/README.md', path.join(root, 'README.md'), 'no-cache')
  const docs = path.join(root, 'docs')
  if (fs.existsSync(docs)) {
    for (const f of fs.readdirSync(docs)) if (f.endsWith('.md')) add(`/docs/${f}`, path.join(docs, f), 'no-cache')
  }
  return assets
}

// ── Helpers ──────────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(message)
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
// The page uses one inline script and inline styles; everything else is same-origin.
const PAGE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

function send(req: http.IncomingMessage, res: http.ServerResponse, status: number, body: Buffer | string, type: string, headers: Record<string, string> = {}, gzipped?: Buffer): void {
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body
  const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))
  let payload = buf
  const h: Record<string, string> = { ...SECURITY_HEADERS, 'Content-Type': type, Vary: 'Accept-Encoding', ...headers }
  if (acceptsGzip && (gzipped ? gzipped !== buf : buf.length > 1024)) {
    payload = gzipped ?? zlib.gzipSync(buf)
    h['Content-Encoding'] = 'gzip'
  }
  h['Content-Length'] = String(payload.length)
  res.writeHead(status, h)
  res.end(req.method === 'HEAD' ? undefined : payload)
}

function sendJson(req: http.IncomingMessage, res: http.ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  send(req, res, status, JSON.stringify(value), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store', ...headers })
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0)
    if (declared > limit) return reject(new HttpError(413, `Request body is larger than ${limit} bytes.`))
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new HttpError(413, `Request body is larger than ${limit} bytes.`))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function clientIp(req: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for']
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
    if (first) return first
  }
  return req.socket.remoteAddress ?? 'unknown'
}

/** Fixed one-minute window per client IP. */
class RateLimiter {
  private readonly hits = new Map<string, { count: number; reset: number }>()
  private readonly timer: NodeJS.Timeout
  constructor(private readonly perMinute: number) {
    this.timer = setInterval(() => {
      const now = Date.now()
      for (const [k, v] of this.hits) if (v.reset <= now) this.hits.delete(k)
    }, 60_000)
    this.timer.unref()
  }
  /** Seconds to wait, or 0 if the request may proceed. */
  take(ip: string): number {
    if (this.perMinute <= 0) return 0
    const now = Date.now()
    const e = this.hits.get(ip)
    if (!e || e.reset <= now) {
      this.hits.set(ip, { count: 1, reset: now + 60_000 })
      return 0
    }
    e.count++
    return e.count > this.perMinute ? Math.ceil((e.reset - now) / 1000) : 0
  }
  stop(): void {
    clearInterval(this.timer)
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

interface ApiRequest {
  text?: unknown
  texts?: unknown
  profile?: unknown
  options?: unknown
  from?: unknown
  to?: unknown
  alternatives?: unknown
  trace?: unknown
  strict?: unknown
}

/** Prepared converters, one cache per server (each server has its own lexicon). */
type ConverterCache = Map<string, ArabicConverter | ArabicToTifinaghConverter>
function converterFor<C extends ArabicConverter | ArabicToTifinaghConverter>(cache: ConverterCache, key: string, make: () => C): C {
  let c = cache.get(key) as C | undefined
  if (!c) {
    c = make()
    if (cache.size > 200) cache.clear()
    cache.set(key, c)
  }
  return c
}

function transliterateRequest(body: ApiRequest, cfg: ServerConfig, cache: ConverterCache): unknown {
  const profile = (body.profile ?? cfg.defaultProfile) as ProfileId
  if (typeof profile !== 'string' || !(profile in PROFILES)) {
    throw new HttpError(400, `'profile' must be one of ${Object.keys(PROFILES).join(', ')}.`)
  }
  if (body.options !== undefined && (typeof body.options !== 'object' || body.options === null || Array.isArray(body.options))) {
    throw new HttpError(400, "'options' must be an object of options (see GET /api/profiles, or /api/profiles?from=arabic).")
  }
  const from = body.from ?? 'tifinagh'
  if (from !== 'tifinagh' && from !== 'latin' && from !== 'arabic') throw new HttpError(400, "'from' must be 'tifinagh', 'latin' or 'arabic'.")
  const to = body.to ?? (from === 'arabic' ? 'tifinagh' : 'arabic')
  if (from === 'arabic' ? to !== 'tifinagh' && to !== 'latin' : to !== 'arabic') {
    throw new HttpError(400, from === 'arabic' ? "With 'from': 'arabic', 'to' must be 'tifinagh' or 'latin'." : "'to' must be 'arabic' (or use 'from': 'arabic').")
  }
  if (from === 'arabic' && body.alternatives === true) throw new HttpError(400, "'alternatives' is available for Arabic output only.")
  const flags = { alternatives: body.alternatives === true, trace: body.trace === true, strict: body.strict === true }

  let texts: string[]
  let batch = false
  if (body.texts !== undefined) {
    if (!Array.isArray(body.texts) || body.texts.some((t) => typeof t !== 'string')) throw new HttpError(400, "'texts' must be an array of strings.")
    if (body.texts.length > cfg.maxBatchItems) throw new HttpError(413, `'texts' has more than ${cfg.maxBatchItems} items.`)
    texts = body.texts as string[]
    batch = true
  } else if (typeof body.text === 'string') {
    texts = [body.text]
  } else {
    throw new HttpError(400, "Send 'text' (a string) or 'texts' (an array of strings).")
  }
  const tooLong = texts.findIndex((t) => t.length > cfg.maxTextChars)
  if (tooLong >= 0) throw new HttpError(413, `Text ${batch ? `#${tooLong} ` : ''}is longer than ${cfg.maxTextChars} characters.`)

  const options = (body.options ?? {}) as Partial<ArabicOptions>
  let convertOne: (t: string) => Record<string, unknown>
  try {
    if (from === 'arabic') {
      const reverse = converterFor(cache, JSON.stringify(['arabic', profile, options, flags]), () =>
        new ArabicToTifinaghConverter({ profile, options: options as Partial<ReverseOptions>, trace: flags.trace, strict: flags.strict, lexicon: cfg.lexicon }),
      )
      convertOne = (t) => {
        const r = reverse.convert(t)
        const out: Record<string, unknown> = { output: r.output, profile: r.profile, warnings: r.warnings }
        if (to === 'latin') {
          const l = tifinaghToLatin(r.output)
          out.output = l.output
          out.tifinagh = r.output
          ;(out.warnings as unknown[]).push(...l.warnings)
        }
        if (r.trace) out.trace = r.trace
        return out
      }
    } else {
      const converter = converterFor(cache, JSON.stringify([profile, options, flags]), () => new ArabicConverter({ profile, arabic: options, ...flags, lexicon: cfg.lexicon }))
      convertOne = (t) => {
        const r = converter.convert(from === 'latin' ? latinToTifinagh(t).output : t)
        const out: Record<string, unknown> = { output: r.output, profile: r.profile, warnings: r.warnings }
        if (r.alternatives) out.alternatives = r.alternatives
        if (r.trace) out.trace = r.trace
        return out
      }
    }
  } catch (e) {
    throw new HttpError(400, (e as Error).message)
  }

  const one = (t: string): Record<string, unknown> => {
    try {
      return convertOne(t)
    } catch (e) {
      if (e instanceof TransliterationError) {
        if (!batch) throw new HttpError(422, e.message, { warnings: e.warnings })
        return { error: e.message, warnings: e.warnings }
      }
      throw e
    }
  }
  return batch ? { profile, results: texts.map(one) } : one(texts[0])
}

// ── Server ───────────────────────────────────────────────────────────────────

export interface RunningServer {
  server: http.Server
  close(): Promise<void>
}

/** Create the HTTP server (not yet listening). */
export function createServer(cfg: ServerConfig): RunningServer {
  const assets = cfg.uiEnabled ? loadAssets(cfg.root) : new Map<string, Asset>()
  const limiter = new RateLimiter(cfg.rateLimitPerMinute)
  const converters: ConverterCache = new Map()
  const version = (() => {
    try {
      return (JSON.parse(fs.readFileSync(path.join(cfg.root, 'package.json'), 'utf8')) as { version: string }).version
    } catch {
      return 'unknown'
    }
  })()

  const cors = (): Record<string, string> =>
    cfg.corsOrigin
      ? { 'Access-Control-Allow-Origin': cfg.corsOrigin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }
      : {}

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const p = url.pathname
    const method = req.method ?? 'GET'

    if (p === '/healthz') {
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Use GET.', {}, { Allow: 'GET, HEAD' })
      return sendJson(req, res, 200, { status: 'ok' })
    }

    if (p === '/api' || p.startsWith('/api/')) {
      if (method === 'OPTIONS') {
        res.writeHead(204, { ...SECURITY_HEADERS, ...cors() })
        res.end()
        return
      }
      const wait = limiter.take(clientIp(req, cfg.trustProxy))
      if (wait > 0) throw new HttpError(429, 'Too many requests. Try again later.', {}, { 'Retry-After': String(wait) })
      const h = cors()

      if (p === '/api' || p === '/api/') {
        if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Use GET.', {}, { Allow: 'GET, HEAD' })
        return sendJson(req, res, 200, {
          endpoints: {
            'GET /api/transliterate?text=…&profile=…': 'Transliterate one text (query string).',
            'POST /api/transliterate':
              "JSON body: {\"text\": \"…\"} or {\"texts\": [\"…\"]}, optional \"profile\", \"options\", \"from\" ('tifinagh'|'latin'|'arabic'), \"to\" ('tifinagh'|'latin' with from=arabic), \"alternatives\", \"trace\", \"strict\".",
            'GET /api/profiles': 'Profiles and their options (?from=arabic for Arabic → Tifinagh).',
            'GET /api/version': 'Version.',
            'GET /healthz': 'Health check.',
          },
          limits: { maxBodyBytes: cfg.maxBodyBytes, maxTextChars: cfg.maxTextChars, maxBatchItems: cfg.maxBatchItems, rateLimitPerMinute: cfg.rateLimitPerMinute },
        }, h)
      }
      if (p === '/api/version') {
        if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Use GET.', {}, { Allow: 'GET, HEAD' })
        return sendJson(req, res, 200, { name: 'amazigh-transliterate', version }, h)
      }
      if (p === '/api/profiles') {
        if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Use GET.', {}, { Allow: 'GET, HEAD' })
        return sendJson(req, res, 200, url.searchParams.get('from') === 'arabic' ? REVERSE_PROFILES : PROFILES, h)
      }
      if (p === '/api/transliterate') {
        let body: ApiRequest
        if (method === 'GET' || method === 'HEAD') {
          const q = url.searchParams
          body = {
            text: q.get('text') ?? undefined,
            profile: q.get('profile') ?? undefined,
            from: q.get('from') ?? undefined,
            to: q.get('to') ?? undefined,
            alternatives: q.get('alternatives') === 'true',
            trace: q.get('trace') === 'true',
            strict: q.get('strict') === 'true',
          }
        } else if (method === 'POST') {
          const type = String(req.headers['content-type'] ?? 'application/json')
          if (!/^application\/json\b/i.test(type)) throw new HttpError(415, "Send the body as JSON with 'Content-Type: application/json'.")
          const raw = await readBody(req, cfg.maxBodyBytes)
          try {
            body = JSON.parse(raw) as ApiRequest
          } catch {
            throw new HttpError(400, 'The request body is not valid JSON.')
          }
          if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'The request body must be a JSON object.')
        } else {
          throw new HttpError(405, 'Use GET or POST.', {}, { Allow: 'GET, HEAD, POST, OPTIONS' })
        }
        return sendJson(req, res, 200, transliterateRequest(body, cfg, converters), h)
      }
      throw new HttpError(404, `No API endpoint at ${p}. See GET /api.`)
    }

    // Web page and its files
    const asset = assets.get(p)
    if (asset) {
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Use GET.', {}, { Allow: 'GET, HEAD' })
      const extra: Record<string, string> = { 'Cache-Control': asset.cache }
      if (p === '/') Object.assign(extra, { 'Content-Security-Policy': PAGE_CSP, 'X-Frame-Options': 'DENY' })
      return send(req, res, 200, asset.body, asset.type, extra, asset.gzip)
    }
    throw new HttpError(404, 'Not found.')
  }

  const server = http.createServer((req, res) => {
    const t0 = process.hrtime.bigint()
    res.on('finish', () => {
      if (!cfg.logRequests) return
      const ms = Number(process.hrtime.bigint() - t0) / 1e6
      process.stdout.write(
        JSON.stringify({ time: new Date().toISOString(), method: req.method, path: (req.url ?? '').split('?')[0], status: res.statusCode, ms: Math.round(ms * 10) / 10 }) + '\n',
      )
    })
    handle(req, res).catch((e: unknown) => {
      if (res.headersSent) return res.destroy()
      if (e instanceof HttpError) {
        const isApi = (req.url ?? '').startsWith('/api')
        return sendJson(req, res, e.status, { error: e.message, ...e.extra }, { ...e.headers, ...(isApi && cfg.corsOrigin ? { 'Access-Control-Allow-Origin': cfg.corsOrigin } : {}) })
      }
      process.stderr.write(`internal error: ${(e as Error)?.stack ?? String(e)}\n`)
      sendJson(req, res, 500, { error: 'Internal error.' })
    })
  })
  server.headersTimeout = 15_000
  server.requestTimeout = 30_000
  server.keepAliveTimeout = 65_000 // longer than typical proxy idle timeouts

  return {
    server,
    close: () =>
      new Promise((resolve) => {
        limiter.stop()
        server.close(() => resolve())
        server.closeIdleConnections?.()
      }),
  }
}
