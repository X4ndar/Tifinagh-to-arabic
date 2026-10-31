#!/usr/bin/env node
/*
 * End-to-end test of demo/index.html in a real browser (Chromium via Playwright),
 * including an axe-core accessibility scan in light and dark mode.
 *
 *   npm run build && node tests-e2e/demo.e2e.cjs
 *
 * Playwright is not a dependency of the library; install it where you run this
 * (CI does `npm i --no-save playwright && npx playwright install chromium`).
 * Set CHROMIUM_PATH to use a specific browser binary.
 */
'use strict'
const path = require('path')
const assert = require('assert/strict')
const { chromium } = require('playwright')
const lib = require('../dist/index.js')

const PAGE = 'file://' + path.resolve(__dirname, '../demo/index.html')
const AXE = require.resolve('axe-core/axe.min.js')
let failures = 0
const results = []

async function check(name, fn) {
  try {
    await fn()
    results.push(`  ✓ ${name}`)
  } catch (e) {
    failures++
    results.push(`  ✕ ${name}\n      ${String(e.message).split('\n').join('\n      ')}`)
  }
}

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(PAGE)
  await page.waitForFunction(() => document.getElementById('out').textContent.length > 0)
  return { ctx, page, errors }
}

async function axe(page) {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes[0].target.join(' ')}`)
  })
}

;(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

  const { ctx, page, errors } = await open(browser, { permissions: ['clipboard-read', 'clipboard-write'] })

  await check('page loads without script errors', async () => {
    assert.deepEqual(errors, [])
  })

  await check('output equals the library for the default text', async () => {
    const src = await page.inputValue('#src')
    assert.equal(await page.textContent('#out'), lib.toArabic(src))
  })

  await check('typing updates the output and underlines the word at the cursor', async () => {
    await page.fill('#src', 'ⴰⵣⵓⵍ ⵜⴰⵎⴰⵣⵉⵖⵜ')
    await page.focus('#src')
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowLeft')
    assert.equal(await page.textContent('#out'), 'أزول تامازيغت')
    assert.equal(await page.textContent('#out mark'), 'تامازيغت')
    assert.match(await page.textContent('#map-title'), /ⵜⴰⵎⴰⵣⵉⵖⵜ/)
  })

  await check('letter map: one column per unit, selecting one explains it', async () => {
    await page.fill('#src', 'ⴰⵙⴳⴳⵯⴰⵙ')
    await page.focus('#src')
    await page.keyboard.press('Home')
    const cols = await page.locator('.thread').count()
    assert.equal(cols, 5)
    await page.locator('.thread').nth(2).click()
    assert.equal(await page.locator('.thread').nth(2).getAttribute('aria-pressed'), 'true')
    const rules = await page.textContent('#unit-rules')
    assert.match(rules, /shadda/)
    assert.match(rules, /damma/)
  })

  await check('profile switch changes the spelling', async () => {
    await page.fill('#src', 'ⴰⴳⴳⴰⵍ')
    await page.check('input[value="ircam"]')
    assert.equal(await page.textContent('#out'), lib.toArabic('ⴰⴳⴳⴰⵍ', { profile: 'ircam' }))
    assert.match(await page.textContent('#profile-note'), /IRCAM/)
    await page.check('input[value="readable"]')
    assert.equal(await page.textContent('#out'), lib.toArabic('ⴰⴳⴳⴰⵍ'))
  })

  await check('warnings appear for malformed input and disappear when fixed', async () => {
    await page.fill('#src', 'ⵯⴰ')
    assert.equal(await page.isVisible('#warnings'), true)
    assert.match(await page.textContent('#warning-list'), /rounding mark/)
    await page.fill('#src', 'ⴰ')
    assert.equal(await page.isVisible('#warnings'), false)
  })

  await check('Tifinagh keyboard inserts at the cursor; Delete removes', async () => {
    await page.fill('#src', '')
    await page.click('summary')
    await page.click('button[aria-label^="Insert ⴰ"]')
    await page.click('button[aria-label^="Insert ⵣ"]')
    await page.click('button[aria-label^="Insert ⵓ"]')
    await page.click('button[aria-label^="Insert ⵍ"]')
    assert.equal(await page.inputValue('#src'), 'ⴰⵣⵓⵍ')
    await page.click('text=Delete')
    assert.equal(await page.inputValue('#src'), 'ⴰⵣⵓ')
  })

  await check('example buttons load the word', async () => {
    await page.click('text=uksum, meat')
    assert.equal(await page.inputValue('#src'), 'ⵓⴽⵙⵓⵎ')
    assert.equal(await page.textContent('#out'), 'ؤكسوم')
  })

  await check('copy puts exactly the Arabic text on the clipboard', async () => {
    await page.click('#copy')
    await page.waitForFunction(() => document.getElementById('copy').textContent === 'Copied')
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'ؤكسوم')
  })

  await check('Clear empties input and output', async () => {
    await page.click('#clear')
    assert.equal(await page.inputValue('#src'), '')
    assert.equal(await page.textContent('#out'), '')
    assert.match(await page.textContent('#map-hint'), /Type a Tifinagh word/)
  })

  await check('large input stays responsive', async () => {
    const big = 'ⵜⴰⵎⴰⵣⵉⵖⵜ '.repeat(5000)
    const t0 = Date.now()
    await page.fill('#src', big)
    const ms = Date.now() - t0
    assert.equal((await page.textContent('#out')).length, 'تامازيغت '.repeat(5000).length)
    assert.ok(ms < 3000, `took ${ms} ms`)
  })

  await check('keyboard users can reach the controls, with a visible focus ring', async () => {
    await page.fill('#src', 'ⴰⵣⵓⵍ')
    await page.check('input[value="readable"]')
    await page.focus('#src')
    await page.keyboard.press('Shift+Tab') // from the text box back to the checked profile radio
    assert.equal(await page.evaluate(() => document.activeElement.value), 'readable')
    const outline = await page.evaluate(() => getComputedStyle(document.querySelector('input[value="readable"] + span')).outlineStyle)
    assert.equal(outline, 'solid')
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.evaluate(() => document.querySelector('input[name="profile"]:checked').value), 'ircam')
    await page.check('input[value="readable"]')
  })

  await check('bundled fonts load (works offline)', async () => {
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return ['Noto Sans Tifinagh', 'Noto Naskh Arabic', 'Noto Sans'].map((f) => document.fonts.check(`16px "${f}"`))
    })
    assert.deepEqual(loaded, [true, true, true])
  })

  await check('accessibility scan (axe-core, WCAG 2.1 AA), light mode', async () => {
    await page.fill('#src', 'ⴰⵣⵓⵍ ⵯ')
    const v = await axe(page)
    assert.deepEqual(v, [])
  })
  await ctx.close()

  const dark = await open(browser, { colorScheme: 'dark' })
  await check('accessibility scan (axe-core, WCAG 2.1 AA), dark mode', async () => {
    const v = await axe(dark.page)
    assert.deepEqual(v, [])
  })
  await dark.ctx.close()

  for (const width of [320, 390, 768]) {
    const m = await open(browser, { viewport: { width, height: 800 } })
    await check(`no horizontal scrolling at ${width}px`, async () => {
      await m.page.click('summary')
      const sw = await m.page.evaluate(() => document.documentElement.scrollWidth)
      assert.ok(sw <= width, `scrollWidth ${sw} > ${width}`)
    })
    await m.ctx.close()
  }

  const motion = await open(browser, { reducedMotion: 'reduce' })
  await check('reduced motion: no transitions', async () => {
    const t = await motion.page.evaluate(() => getComputedStyle(document.querySelector('.btn')).transitionDuration)
    assert.equal(t, '0s')
  })
  await motion.ctx.close()

  await browser.close()
  console.log('demo end-to-end\n' + results.join('\n'))
  console.log(failures ? `\n${failures} failed` : `\nall ${results.length} passed`)
  process.exitCode = failures ? 1 : 0
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
