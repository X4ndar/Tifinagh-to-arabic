# Self-hosting (Coolify, Docker)

The repository ships a small web server: the converter page at `/` and a
JSON API at `/api`. It has no runtime dependencies, keeps no data, writes
nothing to disk, and works offline. One container uses about 13–30 MB of
memory (measured: 13 MB idle, 29 MB after a burst of requests).

| File | Purpose |
|---|---|
| `Dockerfile` | Two-stage build on `node:22-alpine`; runs as the unprivileged `node` user with a built-in health check |
| `docker-compose.yml` | For Coolify's Docker Compose build pack (or any Docker host) |
| `docker-compose.local.yml` | Adds `ports: 3000:3000` for running on your own machine or a plain VPS |
| `.dockerignore` | Keeps tests, data and benchmarks out of the build |

## Coolify

Both ways work; pick one.

### Option A — Docker Compose (recommended)

1. **+ New → Resource → Public repository** (or *Private repository* through
   your GitHub app), paste the repository URL, choose the branch.
2. **Build pack: Docker Compose**. Compose file location: `/docker-compose.yml`.
3. Click **Continue**. Coolify reads the file and shows the `app` service.
4. **Domain**: Coolify generates one from `SERVICE_URL_APP_3000` (it routes
   to container port 3000). To use your own, set the `app` service's domain
   to e.g. `https://amazigh.example.com:3000` — the `:3000` is the container
   port, not a public port; visitors use normal HTTPS.
5. **Environment Variables**: every setting below already appears with its
   default; change only what you need.
6. **Deploy**. When the health check reports *healthy*, open the domain.

### Option B — Dockerfile

1. **+ New → Resource → Public repository**, paste the URL, choose the branch.
2. **Build pack: Dockerfile**.
3. **Ports Exposes: `3000`** (Coolify also reads it from `EXPOSE`).
4. Set the domain and, if needed, environment variables (table below).
5. **Deploy**. Coolify uses the Dockerfile's `HEALTHCHECK` (it calls
   `/healthz` with Node's built-in `fetch`; no curl or wget needed).

Option A also applies the hardening in `docker-compose.yml` (read-only file
system, no Linux capabilities, `no-new-privileges`, 512 MB memory limit).

### Adding a word list (optional)

To force validated spellings (for example official place names):

1. In the resource, **Persistent Storage → + Add → File mount**.
2. Destination path: `/data/lexicon.json`; content: your lexicon, e.g.
   ```json
   [{ "tifinagh": "ⴰⴳⴰⴷⵉⵔ", "arabic": "أكادير", "status": "verified", "source": "official name" }]
   ```
3. Set `LEXICON_PATH=/data/lexicon.json` and redeploy.

The format is described in [architecture.md](architecture.md#lexicon). A file
that cannot be read or is invalid stops the container at start with a clear
message in the logs, rather than running without it.

### Updates

Push to the branch and redeploy (or enable Coolify's automatic deployment on
push). The old container is stopped with SIGTERM; the server finishes
in-flight requests first.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port inside the container. If you change it, change the `3000` in `SERVICE_URL_APP_3000` / *Ports Exposes* too |
| `DEFAULT_PROFILE` | `readable` | Profile used when a request names none: `readable`, `ircam`, `phonetic` |
| `CORS_ORIGIN` | `*` | Which websites may call the API from a browser. `*` = any; e.g. `https://my-site.ma` to allow one; empty = no CORS headers |
| `RATE_LIMIT_PER_MINUTE` | `120` | API requests per minute per client IP; `0` = unlimited. `/healthz` and the page are never limited |
| `MAX_BODY_BYTES` | `1048576` | Largest request body (1 MiB) |
| `MAX_TEXT_CHARS` | `200000` | Longest text accepted |
| `MAX_BATCH_ITEMS` | `1000` | Most texts in one batch request |
| `TRUST_PROXY` | `true` | Take the client IP from `X-Forwarded-For` (correct behind Coolify's proxy). Set `false` if the container is reachable directly |
| `UI_ENABLED` | `true` | `false` = API only, no page at `/` |
| `LOG_REQUESTS` | `true` | One JSON line per request in the container logs |
| `LEXICON_PATH` | *(empty)* | Path of a lexicon JSON file inside the container |
| `LEXICON_ALLOW_PROVISIONAL` | `false` | Let `provisional` lexicon entries override the rules |
| `NODE_IMAGE` *(build)* | `node:22-alpine` | Base image. If Docker Hub rate-limits your server (*429 Too Many Requests*), use `mirror.gcr.io/library/node:22-alpine` |

## API

All responses are JSON (UTF-8). Errors have the form `{"error": "…"}`.

```bash
# one text
curl -s https://amazigh.example.com/api/transliterate \
  -H 'Content-Type: application/json' \
  -d '{"text": "ⴰⵣⵓⵍ ⴼⵍⵍⴰⵡⵏ"}'
# → {"output":"أزول فلّاون","profile":"readable","warnings":[]}

# a batch, another profile, one option changed
curl -s https://amazigh.example.com/api/transliterate \
  -H 'Content-Type: application/json' \
  -d '{"texts": ["ⵉⴼⴰⵙⵙⵏ", "ⵓⴽⵙⵓⵎ"], "profile": "ircam", "options": {"gemination": "shadda"}}'
# → {"profile":"ircam","results":[{"output":"ئفاسّن",…},{"output":"ؤكسوم",…}]}

# Arabic script → Tifinagh (or "to": "latin")
curl -s https://amazigh.example.com/api/transliterate \
  -H 'Content-Type: application/json' \
  -d '{"text": "أزول فلّاون", "from": "arabic"}'
# → {"output":"ⴰⵣⵓⵍ ⴼⵍⵍⴰⵡⵏ","profile":"readable","warnings":[]}

# quick test in a browser address bar
https://amazigh.example.com/api/transliterate?text=ⵜⴰⵎⴰⵣⵉⵖⵜ
https://amazigh.example.com/api/transliterate?from=arabic&text=تامازيغت
```

| Request field | Type | Meaning |
|---|---|---|
| `text` / `texts` | string / array of strings | What to convert (one of the two) |
| `profile` | `readable` \| `ircam` \| `phonetic` | Default: `DEFAULT_PROFILE` |
| `options` | object | Any option from `GET /api/profiles`, e.g. `{"initialVowels": "hamza-seat", "g": "ng"}`; with `from: "arabic"`, from `GET /api/profiles?from=arabic`, e.g. `{"semivowels": "marked"}` |
| `from` | `tifinagh` \| `latin` \| `arabic` | Input script (default `tifinagh`) |
| `to` | `arabic` \| `tifinagh` \| `latin` | Output script: `arabic` for Tifinagh/Latin input; `tifinagh` (default) or `latin` for Arabic input. With `latin`, each result also has `tifinagh` |
| `alternatives`, `trace` | boolean | Also return other accepted spellings (Arabic output only) / the rules applied |
| `strict` | boolean | Fail on unsupported or malformed input: HTTP 422 for one text, an `error` per item in a batch |

| Status | When |
|---|---|
| 200 | Converted |
| 400 | Invalid JSON or fields (the message says which) |
| 404 / 405 | Unknown path / wrong method |
| 413 | Body, text or batch over the limits |
| 415 | Body not sent as `application/json` |
| 422 | `strict` and the text has a problem (with `warnings`) |
| 429 | Rate limit reached (`Retry-After` says when to retry) |

Other endpoints: `GET /healthz`, `GET /api`, `GET /api/version`,
`GET /api/profiles` (`?from=arabic` for the Arabic → Tifinagh options).

From Python (standard library only):

```python
from amazigh_transliterate import HttpTransliterator   # python/amazigh_transliterate.py
tr = HttpTransliterator("https://amazigh.example.com")
tr.convert("ⴰⵣⵓⵍ")                        # 'أزول'
tr.convert_many(corpus_lines)              # sent in batches of 500
HttpTransliterator("https://amazigh.example.com", source="arabic").convert("أزول")  # 'ⴰⵣⵓⵍ'
```

## Any other Docker host

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
# → http://localhost:3000
```

Without Docker: `npm ci && npm run build && npm start` (Node.js 18 or newer).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails with *429 Too Many Requests* pulling `node:22-alpine` | Docker Hub limits anonymous pulls per IP. Set the build variable `NODE_IMAGE=mirror.gcr.io/library/node:22-alpine` (same official image), or log the server in to Docker Hub |
| *Bad Gateway* / *no available server* | The domain must point at container port 3000 (`…:3000` in the domain, or *Ports Exposes 3000*). Check the logs for `"msg":"listening"` |
| Container restarts at once with `configuration error: …` | A setting has an invalid value; the message names it |
| Browser apps get CORS errors | Set `CORS_ORIGIN` to your site's origin (or `*`) |
| All users share one rate limit | `TRUST_PROXY` must be `true` behind Coolify's proxy |
