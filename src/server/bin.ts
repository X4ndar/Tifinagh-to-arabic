#!/usr/bin/env node
/**
 * Start the web server:  PORT=3000 node dist/server/bin.js
 * Configuration is read from environment variables (docs/deploy.md).
 */
import { configFromEnv, createServer } from './server'

let config
try {
  config = configFromEnv()
} catch (e) {
  process.stderr.write(`configuration error: ${(e as Error).message}\n`)
  process.exit(1)
}

const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '0.0.0.0'
const app = createServer(config)

app.server.listen(port, host, () => {
  process.stdout.write(
    JSON.stringify({
      time: new Date().toISOString(),
      msg: 'listening',
      url: `http://${host}:${port}`,
      profile: config.defaultProfile,
      lexiconWords: config.lexicon?.size ?? 0,
      rateLimitPerMinute: config.rateLimitPerMinute,
    }) + '\n',
  )
})

let stopping = false
const stop = (signal: string): void => {
  if (stopping) return
  stopping = true
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), msg: 'stopping', signal }) + '\n')
  // finish in-flight requests, then exit; give up after 10 s
  setTimeout(() => process.exit(0), 10_000).unref()
  app.close().then(() => process.exit(0))
}
process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))
