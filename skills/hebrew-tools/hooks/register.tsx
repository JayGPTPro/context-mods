// Hebrew tools: buttons above the prompt, every one reversible.
// "Translate to Hebrew" translates the English text blocks of the last reply that has any and draws the
// Hebrew in their place; "↩ Original" and "Show Hebrew" switch every translation back and forth.
// "⇄ Left" and "⇄ Right" flip the side Hebrew lines align to, with a direction mark at the start of
// each line. Only the drawing changes: the transcript, and what Claude reads, stay as written.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { Direction } from '../types'
import { COLUMN_PX, DIVIDER, ROW_KEY, buttonPx, seat } from './panel'

const direction = atom({ plugin: 'hebrew-tools', key: 'direction' } as const, 'rtl')
const showHebrew = atom({ plugin: 'hebrew-tools', key: 'showHebrew' } as const, true)
const isBusy = atom({ plugin: 'hebrew-tools', key: 'isBusy' } as const, false)
const englishIds = atom({ plugin: 'hebrew-tools', key: 'englishIds' } as const, [])
const translatedCount = atom({ plugin: 'hebrew-tools', key: 'translatedCount' } as const, 0)
const TRANSLATION = { plugin: 'hebrew-tools', key: 'translation' } as const

// Translation is asked for by a press, and a long reply needs the stronger model to read well.
const MODEL = 'sonnet'
const SYSTEM = [
  "You translate an AI coding assistant's reply into Hebrew for an Israeli reader using it in a chat app.",
  'Write natural, everyday Hebrew, the way people talk. Not formal, not literary.',
  'Keep exactly as written: code, commands, file names and paths, URLs, numbers, prices, product, tool and model names, and anything inside backticks or code blocks.',
  'Keep the markdown structure: headings, lists, bold, tables and line breaks.',
  'Never use an em dash or an en dash. Use a comma or a colon, and "עד" for ranges.',
  'Return only the translation, with nothing before or after it.',
].join('\n')

// How many replies back the button looks for one with English in it.
const REPLIES_BACK = 5

const RLM = '‏'
const LRM = '‎'
const HEBREW = /[֐-׿]/
const HEBREW_ALL = /[֐-׿]/g
const LATIN_ALL = /[A-Za-z]/g
const FENCE = /^\s*(```|~~~)/
const TABLE_ROW = /^\s*\|/
// List, heading and quote markers, then any bold or italic opener: the mark goes after them, so the
// markdown still parses and the mark is the line's first strong character.
const OPENER = /^(\s*(?:(?:[-*+]|\d+[.)])\s+|#{1,6}\s+|>\s?)*(?:\*\*|__|~~|\*|_)*)/

/** The text without code, links and paths, which should not count as English. */
const prose = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(?:~|\.{1,2})?\/[^\s)]+/g, ' ')

/** Mostly English prose: 25 Latin letters or more, and under a fifth of the letters Hebrew. */
const isEnglish = (text: string) => {
  const body = prose(text)
  const hebrew = body.match(HEBREW_ALL)?.length ?? 0
  const latin = body.match(LATIN_ALL)?.length ?? 0
  return latin >= 25 && hebrew / (hebrew + latin) < 0.2
}

/** One id for a text block, the same for the stored row and for the block on screen. */
const keyOf = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  let hash = 5381
  for (let i = 0; i < flat.length; i += 1) hash = (Math.imul(hash, 33) + flat.charCodeAt(i)) | 0
  return `${flat.length.toString(36)}-${(hash >>> 0).toString(36)}`
}

/** A line Hebrew carries: some Hebrew, and at least half as many Hebrew letters as Latin ones. */
const isHebrewLine = (line: string) => {
  const body = prose(line)
  const hebrew = body.match(HEBREW_ALL)?.length ?? 0
  const latin = body.match(LATIN_ALL)?.length ?? 0
  return hebrew > 0 && hebrew * 2 >= latin
}

/** Puts `mark` after the markdown opener of every line `picks` chooses; code blocks are left alone. */
const markLines = (markdown: string, mark: string, picks: (line: string) => boolean) => {
  let isCode = false
  return markdown
    .split('\n')
    .map(line => {
      if (FENCE.test(line)) {
        isCode = !isCode
        return line
      }
      if (isCode || !picks(line)) return line
      if (TABLE_ROW.test(line)) {
        return line.replace(/\|([^|]*)/g, (cell, body: string) => (picks(body) ? `|${mark}${body}` : cell))
      }
      const opener = OPENER.exec(line)?.[1] ?? ''
      return line.startsWith(mark, opener.length) ? line : opener + mark + line.slice(opener.length)
    })
    .join('\n')
}

/** Right: Hebrew lines align right even when they open in English. Left: every Hebrew line aligns left. */
const orient = (markdown: string, side: Direction) =>
  side === 'rtl' ? markLines(markdown, RLM, isHebrewLine) : markLines(markdown, LRM, line => HEBREW.test(line))

/** No em or en dashes in the translation; the model can still slip one in. */
const withoutDashes = (text: string) =>
  text.replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2').replace(/\s*[–—]\s*/g, ', ')

/** What the person typed, for a prompt row; null for tool results, reminders and notifications. */
const typed = (row: SessionMessage) => {
  if (row.role !== 'user' || (row.toolResults?.length ?? 0) > 0) return null
  const text = row.text.replace(/^(\s*<system-reminder>[\s\S]*?<\/system-reminder>)+/, '').trim()
  return text !== '' && !/^<(?!pasted_content)/.test(text) && !text.startsWith('Caveat:') ? text : null
}

/** The English text blocks of the most recent reply that has any, within the last few replies. */
const lastEnglish = (rows: readonly SessionMessage[]) => {
  const blocks: string[] = []
  let replies = 0
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]
    if (row === undefined) continue
    if (typed(row) !== null) {
      replies += 1
      if (blocks.length > 0 || replies >= REPLIES_BACK) break
      continue
    }
    const text = row.role === 'assistant' ? row.text.trim() : ''
    if (text !== '' && isEnglish(text)) blocks.unshift(text)
  }
  return blocks
}

const refresh = async ($: EngineInterface) => {
  const rows = await $.session.messages()
  const ids = lastEnglish(rows).map(keyOf)
  await update($, englishIds, () => ids)
}

const translate = async ($: EngineInterface) => {
  if (await read($, isBusy)) return
  await update($, isBusy, () => true)
  try {
    const blocks = lastEnglish(await $.session.messages())
    if (blocks.length === 0) {
      $.ui.toast('No English text in the last replies')
      return
    }
    await Promise.all(
      blocks.map(async text => {
        const target = atom({ ...TRANSLATION, id: keyOf(text) }, null)
        if ((await read($, target)) !== null) return
        const reply = await $.model.complete({ model: MODEL, system: SYSTEM, prompt: text, maxTokens: 16000, effort: 'low', timeoutMs: 180_000 })
        if (!reply.isAnswered) throw new Error(reply.reason)
        const hebrew = withoutDashes(reply.text.trim())
        await update($, target, () => hebrew)
        await update($, translatedCount, n => n + 1)
      }),
    )
    await update($, englishIds, () => blocks.map(keyOf))
    await update($, showHebrew, () => true)
    $.ui.toast('Translation ready. It shows in place of the English message')
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    $.ui.toast(`Translation failed: ${why.slice(0, 120)}`, { timeoutMs: 8000 })
  } finally {
    await update($, isBusy, () => false)
  }
}

const flip = async ($: EngineInterface) => {
  const side: Direction = (await read($, direction)) === 'rtl' ? 'ltr' : 'rtl'
  await update($, direction, () => side)
  await $.store.set('direction', side).catch(() => undefined)
}

// ---------- the dock look ----------
// The same look as Smart PreCompact's row, so the two read as one panel.
// On the desktop each row above the prompt is one SVG image (a pale brand tile, then a few
// quiet chips) beside the native buttons. HTML inside the SVG gives the system font and
// right-to-left Hebrew. It must stay a plain image: an interactive SVG drops the HTML and draws
// nothing (probed in the Code tab, 6.10.26). Color is kept for what needs a person: only a
// warning or a failure is a filled pill; everything else is text with a small dot or icon.
const DOCK_H = 26
const DOCK_LEAD = 30 // the tile and the space after it
const DOCK_FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif"
const DOCK_HEBREW = /[֐-׿]/
const DOCK_CSS = [
  `.r{display:flex;align-items:center;height:${DOCK_H}px;font:500 12px/1 ${DOCK_FONT};color:#45413b;white-space:nowrap;overflow:hidden;-webkit-font-smoothing:antialiased}`,
  '.tile{flex:none;display:flex;width:20px;height:20px;margin-right:10px}',
  '.sep{flex:none;width:3px;height:3px;border-radius:2px;background:rgba(60,55,45,.2);margin:0 6px}',
  '.c{display:inline-flex;align-items:center;gap:6px;height:20px;flex:none;padding:0 1px}',
  '.c i{width:6px;height:6px;border-radius:3px;flex:none;background:#aaa59c}',
  '.c s{text-decoration:none;color:#9b968d;font-weight:400}',
  '.c svg{flex:none}',
  '.good i{background:#36a463}',
  '.info{color:#2f5ea8}',
  '.info i{background:#3b74d9}',
  '.quiet{color:#8d887f;font-weight:450}',
  '.warn,.bad{padding:0 9px;border-radius:10px}',
  '.warn{color:#8a520a;background:rgba(232,152,30,.16)}',
  '.warn i{background:#e0901c}',
  '.bad{color:#ad3527;background:rgba(225,72,56,.12)}',
  '.bad i{background:#e0483a}',
  '.m{display:inline-flex;align-items:center;gap:8px;flex:none}',
  '.m em{font-style:normal;font-weight:600;font-variant-numeric:tabular-nums;color:#45413b}',
  '.m em.warm{color:#c4613d}',
  '.m em.hot{color:#d23b2d}',
  '.bar{position:relative;width:96px;height:4px;border-radius:2px;background:rgba(45,40,30,.1)}',
  '.bar b{position:absolute;left:0;top:0;bottom:0;border-radius:2px}',
  '.bar u{position:absolute;top:-2px;width:1.5px;height:8px;margin-left:-1px;border-radius:1px;background:rgba(45,40,30,.22)}',
  '@media (prefers-color-scheme:dark){.r{color:#dedad3}.sep{background:rgba(255,255,255,.2)}.c s{color:#8f8a82}.info{color:#9bbcf6}.quiet{color:#9a958d}.warn{color:#f2bd63;background:rgba(240,170,60,.17)}.bad{color:#ff8f80;background:rgba(240,90,70,.18)}.m em{color:#dedad3}.m em.warm{color:#f0956c}.bar{background:rgba(255,255,255,.14)}.bar u{background:rgba(255,255,255,.3)}}',
].join('')

type DockTone = 'good' | 'warn' | 'bad' | 'info' | 'plain' | 'quiet'
type DockChip = { html: string; px: number }

function dockEsc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// One chip (about 6px a character in the real font, measured 6.10.26). Hebrew runs right to
// left with its mark on the right; `dim` trails lighter; `icon` is trusted SVG markup drawn in
// place of the dot, and a quiet chip has no dot. `px` is the width it is expected to take.
function dockChip(text: string, tone: DockTone, extra: { dim?: string; icon?: string } = {}): DockChip {
  const dir = DOCK_HEBREW.test(text) ? 'rtl' : 'ltr'
  const mark = extra.icon ?? (tone === 'quiet' ? '' : '<i></i>')
  const dim = extra.dim ? ` <s>${dockEsc(extra.dim)}</s>` : ''
  const chars = text.length + (extra.dim ? extra.dim.length + 1 : 0)
  const isPill = tone === 'warn' || tone === 'bad'
  const px = Math.ceil(chars * 6.1 + (isPill ? 20 : 2) + (mark ? 12 : 0))
  return { html: `<span class="c ${tone}" dir="${dir}">${mark}<span>${dockEsc(text)}</span>${dim}</span>`, px }
}

// The whole row as an SVG document: the tile, then the chips with a small dot between them.
function dockRow(width: number, tile: string, chips: DockChip[]): string {
  const w = Math.max(DOCK_LEAD, Math.round(width))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${DOCK_H}" viewBox="0 0 ${w} ${DOCK_H}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${DOCK_H}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" class="r"><style>${DOCK_CSS}</style>` +
    `<span class="tile">${tile}</span>${chips.map(c => c.html).join('<span class="sep"></span>')}</div>` +
    '</foreignObject></svg>'
  )
}

// ---------- end of the dock look ----------

// The tile: the paragraph mark over an arrow pointing left (right to left) on a pale blue square.
const TILE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
  '<rect width="20" height="20" rx="6" fill="#e6edfc"/>' +
  '<path d="M9.6 3.4H8a2.75 2.75 0 0 0 0 5.5h1.6z" fill="#2a5bd7"/>' +
  '<g fill="none" stroke="#2a5bd7" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M9.6 3.4v8.4M12.2 3.4v8.4M9 3.4h4.2"/><path d="M15 15.6H5.4M7.3 13.8l-1.9 1.8 1.9 1.8"/></g></svg>'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // A reload mid-translation would otherwise leave the row saying it is still translating.
    await update($, isBusy, () => false)
    if ((await $.store.get('direction').catch(() => undefined)) === 'ltr') await update($, direction, () => 'ltr')
    await refresh($).catch(() => undefined)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await refresh($).catch(() => undefined)
    return done
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const original = e.props.text
    let text = original
    if (isEnglish(original) && (await read($, showHebrew))) {
      text = (await read($, atom({ ...TRANSLATION, id: keyOf(original) }, null))) ?? original
    }
    if (HEBREW.test(text)) text = orient(text, await read($, direction))
    return text === original ? next(e) : next({ ...e, props: { ...e.props, text } })
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!HEBREW.test(e.props.text)) return next(e)
    const text = orient(e.props.text, await read($, direction))
    return text === e.props.text ? next(e) : next({ ...e, props: { ...e.props, text } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // Shown in every session, so a glance says the mod is loaded.
    const ids = await read($, englishIds)

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const side = await read($, direction)
    const isWorking = await read($, isBusy)
    const isShown = await read($, showHebrew)
    const translations = await read($, translatedCount)
    let ready = 0
    for (const id of ids) if ((await read($, atom({ ...TRANSLATION, id }, null))) !== null) ready += 1
    const needsTranslation = ids.length > 0 && ready < ids.length
    // The last reply's own translations count too, so one made before the counter existed can still go back.
    const hasTranslations = translations > 0 || ready > 0

    // The desktop draws the dock look with no hotkey badges; a terminal keeps them, its keys are how
    // a person presses. Asked by surface: the terminal's table answers 'Svg' too and draws nothing for it.
    const isDesktop = e.surface === 'desktop' && 'Svg' in ui
    const key = (letter: string) => (isDesktop ? undefined : letter)
    const labels = [
      !isWorking && needsTranslation ? 'Translate to Hebrew' : null,
      !hasTranslations ? null : isShown ? '↩ Original' : 'Show Hebrew',
      side === 'rtl' ? '⇄ Left' : '⇄ Right',
    ]
    const buttons = [
      labels[0] ? (
        <Button key="translate" label={labels[0]} hotkey={key('t')} variant={isDesktop ? undefined : 'primary'} onPress={() => translate($)} />
      ) : null,
      !hasTranslations ? null : isShown ? (
        <Button key="original" label="↩ Original" hotkey={key('b')} onPress={() => update($, showHebrew, () => false)} />
      ) : (
        <Button key="hebrew" label="Show Hebrew" hotkey={key('e')} onPress={() => update($, showHebrew, () => true)} />
      ),
      <Button key="direction" label={side === 'rtl' ? '⇄ Left' : '⇄ Right'} hotkey={key('r')} onPress={() => flip($)} />,
      // A tree built by hand, not by JSX, keeps every child as given: the empty slots go.
    ].filter(child => child !== null)
    const buttonsPx = labels.reduce<number>((sum, label) => sum + (label ? buttonPx(label) : 0), 0)
    // Another mod's row, or the engine's own, stays under this one.
    const beneath = await next(e)

    if (isDesktop && 'Svg' in ui) {
      const Svg = ui.Svg
      // Only the moment that needs words gets a chip: a translation running.
      const chips: DockChip[] = isWorking ? [dockChip('Translating...', 'info')] : []
      const leadPx = DOCK_LEAD + chips.reduce((sum, chip) => sum + chip.px, 0) + 4
      const tile = <Svg source={dockRow(leadPx, TILE, chips)} alt="Hebrew" width={leadPx} height={DOCK_H} />
      const divider = <Svg source={DIVIDER} alt="" width={9} height={16} />
      const placed = seat(beneath, [tile, ...buttons], { px: leadPx + COLUMN_PX + buttonsPx, columns: e.props.bodyColumns, isDesktop, divider })
      if ('tree' in placed) return placed.tree
      return (
        <Box flexDirection="column">
          <Box key={ROW_KEY} flexDirection="row" alignItems="center" gap={1}>
            {tile}
            <Box flexGrow={1} />
            {placed.carry}
            {buttons}
          </Box>
          {placed.beneath}
        </Box>
      )
    }

    const working = isWorking ? [<Text dimColor>Translating...</Text>] : []
    const placed = seat(beneath, [...working, ...buttons], { px: 0, columns: e.props.bodyColumns, isDesktop: false, divider: null })
    if ('tree' in placed) return placed.tree
    return (
      <Box flexDirection="column">
        <Box key={ROW_KEY} flexDirection="row" gap={1} alignItems="center">
          <Text color="claude" bold>
            Hebrew
          </Text>
          {working}
          {buttons}
        </Box>
        {placed.beneath}
      </Box>
    )
  })
}
