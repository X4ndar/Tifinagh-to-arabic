/**
 * HTTP server (src/server): routes, limits, errors, CORS, rate limiting,
 * compression and path safety. Runs a real server on a random local port.
 */
import { AddressInfo } from 'net'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gunzipSync } from 'zlib'
import { request } from 'http'
import { configFromEnv, createServer, type ServerConfig } from '../src/server/server'
import { toArabic } from '../src/index'

type Started = { base: string; close: () => Promise<void> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any
/** Parse a JSON response body. */
const json = async (r: Response | Promise<Response>): Promise<J> => (await r).json() as Promise<J>

async function start(env: NodeJS.ProcessEnv = {}): Promise<Started> {
  const cfg: ServerConfig = { ...configFromEnv({ LOG_REQUESTS: 'false', ...env }) }
  const app = createServer(cfg)
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()))
  const { port } = app.server.address() as AddressInfo
  return { base: `http://127.0.0.1:${port}`, close: app.close }
}

/** Raw request (fetch cannot send some malformed requests). */
function raw(base: string, path: string, opts: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const u = new URL(base)
    const req = request({ host: u.hostname, port: u.port, path, method: opts.method ?? 'GET', headers: opts.headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

const post = (base: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/transliterate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })

describe('HTTP server', () => {
  let s: Started
  beforeAll(async () => {
    s = await start()
  })
  afterAll(() => s.close())

  test('health check', async () => {
    const r = await fetch(`${s.base}/healthz`)
    expect(r.status).toBe(200)
    expect(await json(r)).toEqual({ status: 'ok' })
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  })

  test('GET /api/transliterate with a query string', async () => {
    const r = await fetch(`${s.base}/api/transliterate?text=${encodeURIComponent('ⴰⵣⵓⵍ')}&profile=ircam`)
    expect(r.status).toBe(200)
    expect(await json(r)).toEqual({ output: 'ازول', profile: 'ircam', warnings: [] })
  })

  test('POST one text gives exactly the library output, with options, alternatives and trace', async () => {
    const text = 'ⴰⵣⵓⵍ, bonjour! ⵜⴰⵎⴰⵣⵉⵖⵜ'
    const r = await post(s.base, { text, profile: 'phonetic', options: { gemination: 'double' }, alternatives: true, trace: true })
    const j = await json(r)
    expect(j.output).toBe(toArabic(text, { profile: 'phonetic', arabic: { gemination: 'double' } }))
    expect(j.alternatives).toHaveLength(2)
    expect(j.trace.length).toBeGreaterThan(0)
  })

  test('POST a batch; strict failures are reported per item', async () => {
    const r = await post(s.base, { texts: ['ⴰⵎⵖⴰⵔ', 'ⵯ', ''], strict: true })
    const j = await json(r)
    expect(r.status).toBe(200)
    expect(j.results[0].output).toBe('أمغار')
    expect(j.results[1].error).toMatch(/Strict mode/)
    expect(j.results[2].output).toBe('')
  })

  test('strict failure on a single text is 422 with the warnings', async () => {
    const r = await post(s.base, { text: 'ⵯ', strict: true })
    expect(r.status).toBe(422)
    expect((await json(r)).warnings[0].code).toBe('ORPHAN_LABIALIZATION')
  })

  test('latin input', async () => {
    expect((await json(post(s.base, { text: 'tamazight', from: 'latin' }))).output).toBe('تامازيغت')
  })

  test.each([
    [{}, 400, /Send 'text'/],
    [{ text: 5 }, 400, /Send 'text'/],
    [{ texts: ['a', 1] }, 400, /array of strings/],
    [{ text: 'ⴰ', profile: 'x' }, 400, /'profile' must be one of/],
    [{ text: 'ⴰ', options: [] }, 400, /'options' must be an object/],
    [{ text: 'ⴰ', options: { g: 'nope' } }, 400, /Invalid value "nope" for option 'g'/],
    [{ text: 'ⴰ', from: 'arabic' }, 400, /'from' must be/],
    ['{not json', 400, /not valid JSON/],
    ['[1,2]', 400, /must be a JSON object/],
  ])('bad request %#', async (body, status, msg) => {
    const r = await post(s.base, body)
    expect(r.status).toBe(status)
    expect((await json(r)).error).toMatch(msg)
  })

  test('wrong content type is 415; wrong method is 405 with Allow', async () => {
    const a = await fetch(`${s.base}/api/transliterate`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' })
    expect(a.status).toBe(415)
    const b = await fetch(`${s.base}/api/transliterate`, { method: 'PUT' })
    expect(b.status).toBe(405)
    expect(b.headers.get('allow')).toMatch(/POST/)
    expect((await fetch(`${s.base}/healthz`, { method: 'POST' })).status).toBe(405)
  })

  test('unknown paths are 404, including traversal attempts', async () => {
    expect((await fetch(`${s.base}/api/nothing`)).status).toBe(404)
    expect((await fetch(`${s.base}/nothing`)).status).toBe(404)
    for (const p of ['/../package.json', '/fonts/../../package.json', '/fonts/%2e%2e/%2e%2e/package.json', '/docs/../src/index.ts', '/demo/index.html']) {
      expect((await raw(s.base, p)).status).toBe(404)
    }
  })

  test('the web page, its bundle and fonts are served with the right headers', async () => {
    const page = await fetch(`${s.base}/`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toMatch(/text\/html/)
    expect(page.headers.get('content-security-policy')).toMatch(/frame-ancestors 'none'/)
    expect(await page.text()).toMatch(/Tamazight in Arabic letters/)
    const font = await fetch(`${s.base}/fonts/NotoSansTifinagh-400.woff2`)
    expect(font.headers.get('content-type')).toBe('font/woff2')
    expect(font.headers.get('cache-control')).toMatch(/immutable/)
    expect((await fetch(`${s.base}/docs/limitations.md`)).status).toBe(200)
  })

  test('gzip for clients that accept it; HEAD sends no body', async () => {
    const r = await raw(s.base, '/', { headers: { 'Accept-Encoding': 'gzip' } })
    expect(r.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(r.body).toString('utf8')).toMatch(/<!doctype html>/i)
    const h = await raw(s.base, '/', { method: 'HEAD' })
    expect(h.status).toBe(200)
    expect(h.body.length).toBe(0)
  })

  test('CORS: preflight and headers on API responses', async () => {
    const pre = await fetch(`${s.base}/api/transliterate`, { method: 'OPTIONS' })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('*')
    expect(pre.headers.get('access-control-allow-methods')).toMatch(/POST/)
    const r = await fetch(`${s.base}/api/profiles`)
    expect(r.headers.get('access-control-allow-origin')).toBe('*')
    expect(Object.keys(await json(r))).toEqual(['ircam', 'readable', 'phonetic'])
  })

  test('index and version endpoints', async () => {
    expect((await json(fetch(`${s.base}/api`))).endpoints['POST /api/transliterate']).toBeDefined()
    expect((await json(fetch(`${s.base}/api/version`))).name).toBe('amazigh-transliterate')
  })
})

describe('HTTP server limits and configuration', () => {
  test('body, text and batch limits', async () => {
    const s = await start({ MAX_BODY_BYTES: '200', MAX_TEXT_CHARS: '10', MAX_BATCH_ITEMS: '2' })
    try {
      expect((await post(s.base, { text: 'ⴰ'.repeat(100) })).status).toBe(413)
      expect((await post(s.base, { text: 'ⴰ'.repeat(11) })).status).toBe(413)
      expect((await post(s.base, { texts: ['a', 'b', 'c'] })).status).toBe(413)
      expect((await post(s.base, { texts: ['ⴰ', 'ⴱ'] })).status).toBe(200)
    } finally {
      await s.close()
    }
  })

  test('rate limiting per client IP (X-Forwarded-For behind a proxy)', async () => {
    const s = await start({ RATE_LIMIT_PER_MINUTE: '3' })
    try {
      const hit = (ip: string) => fetch(`${s.base}/api/version`, { headers: { 'X-Forwarded-For': `${ip}, 10.0.0.1` } })
      for (let i = 0; i < 3; i++) expect((await hit('1.1.1.1')).status).toBe(200)
      const limited = await hit('1.1.1.1')
      expect(limited.status).toBe(429)
      expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
      expect((await hit('2.2.2.2')).status).toBe(200) // other clients unaffected
      expect((await fetch(`${s.base}/healthz`)).status).toBe(200) // health check never limited
    } finally {
      await s.close()
    }
  })

  test('CORS can be turned off; the page can be turned off (API only)', async () => {
    const s = await start({ CORS_ORIGIN: '', UI_ENABLED: 'false' })
    try {
      const r = await fetch(`${s.base}/api/version`)
      expect(r.headers.get('access-control-allow-origin')).toBeNull()
      expect((await fetch(`${s.base}/`)).status).toBe(404)
    } finally {
      await s.close()
    }
  })

  test('a lexicon file is applied', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amz-'))
    const file = join(dir, 'lexicon.json')
    writeFileSync(file, JSON.stringify([{ tifinagh: 'ⴰⴳⴰⴷⵉⵔ', arabic: 'أكادير', status: 'verified', source: 'test' }]))
    const s = await start({ LEXICON_PATH: file })
    try {
      expect((await json(post(s.base, { text: 'ⴰⴳⴰⴷⵉⵔ' }))).output).toBe('أكادير')
    } finally {
      await s.close()
    }
  })

  test.each([
    [{ RATE_LIMIT_PER_MINUTE: 'abc' }, /RATE_LIMIT_PER_MINUTE must be a non-negative integer/],
    [{ TRUST_PROXY: 'maybe' }, /TRUST_PROXY must be true or false/],
    [{ DEFAULT_PROFILE: 'fancy' }, /DEFAULT_PROFILE must be one of/],
    [{ LEXICON_PATH: '/nonexistent/lexicon.json' }, /LEXICON_PATH: cannot read/],
  ])('invalid configuration is rejected with a clear message %#', (env, msg) => {
    expect(() => configFromEnv(env)).toThrow(msg)
  })

  test('invalid lexicon file is rejected with a clear message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'amz-'))
    const file = join(dir, 'bad.json')
    writeFileSync(file, '[{"tifinagh":"x"}]')
    expect(() => configFromEnv({ LEXICON_PATH: file })).toThrow(/is not a valid lexicon/)
  })
})
