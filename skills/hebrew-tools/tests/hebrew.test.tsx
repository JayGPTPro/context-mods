// The buttons above the prompt, the translation swap, and the right-to-left marks, on both surfaces.
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const PLUGIN = 'hebrew-tools'
const RLM = '‏'
const LRM = '\u200E'
const SURFACES = ['terminal', 'desktop'] as const
type Surface = (typeof SURFACES)[number]
type Engine = Parameters<TestBody>[0]

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} }
const ENGLISH = 'Here is the full report. The five mods below keep your way of working and cut what it costs you.'
const ENGLISH_2 = 'Another English block from the same reply, long enough to count as English prose.'
const TRANSLATED = 'הנה הדוח המלא, בעברית.'

type Row = { role: 'user' | 'assistant'; text: string; toolUses: never[]; toolResults?: unknown[] }
const prompt = (text: string): Row => ({ role: 'user', text, toolUses: [] })
const answer = (text: string): Row => ({ role: 'assistant', text, toolUses: [] })
const toolResult = (): Row => ({ role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't1', text: 'ok', isError: false }] })

type World = {
  rows: Row[]
  completes: string[]
  reply: (prompt: string) => unknown
  toasts: string[]
  store: Map<string, unknown>
}

const world = (on: On, rows: Row[], beneath: 'engine' | 'host' | 'shared' = 'engine'): World => {
  const w: World = {
    rows,
    completes: [],
    // A dash in the reply, which the mod must take out.
    reply: () => ({ isAnswered: true, text: 'הנה הדוח המלא — בעברית.', usage: { input_tokens: 1, output_tokens: 1 } }),
    toasts: [],
    store: new Map(),
  }
  on('session.messages', () => ({ value: w.rows as never }))
  on('model.complete', (_, e) => {
    w.completes.push(e.prompt)
    return { value: w.reply(e.prompt) as never }
  })
  on('store.get', (_, e) => ({ value: w.store.get(e.key) }))
  on('store.set', (_, e) => {
    w.store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))
  // The engine's own drawings, keyed so a test reads what reached them.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Button } = ui
    // Smart PreCompact's row as it reaches this hook: its image, a spacer, its two buttons.
    if (beneath === 'host') {
      return (
        <Box key="spc-band" flexDirection="row" alignItems="center" gap={1}>
          {'Svg' in ui ? <ui.Svg source={'<svg xmlns="http://www.w3.org/2000/svg" width="190" height="26"></svg>'} alt="spc-placeholder" width={190} height={26} /> : null}
          <Box flexGrow={1} />
          <Button key="compact" label="Smart compact" onPress={() => undefined} />
          <Button key="hide" label="Hide" onPress={() => undefined} />
        </Box>
      )
    }
    // Another mod of the collection drew the shared row beneath: Copy chat's, as it reaches this hook.
    if (beneath === 'shared') {
      return (
        <Box key="engine-band" flexDirection="column">
          <Box key="mods-row" flexDirection="row" alignItems="center" gap={1}>
            <Box flexGrow={1} />
            <Button key="copy-chat" label="Copy chat" onPress={() => undefined} />
          </Box>
        </Box>
      )
    }
    return <Box key="engine-band" />
  })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="drawn">{e.props.text}</Text>
  })
  return w
}

const start = ($: Engine) => ($ as never as { session: { start: (e: never) => Promise<unknown> } }).session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)

const mountBand = ($: Engine, surface: Surface) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND as never })

/** What the transcript draws for one assistant text block (a bare Text: the kit keeps no key on it). */
const drawn = async ($: Engine, surface: Surface, text: string) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } as never })
  const tree = (await ui.drawn()) as { children?: unknown[] }
  await ui.unmount()
  return (tree.children ?? []).filter(child => typeof child === 'string').join('')
}

describe('right alignment', () => {
  test('marks every Hebrew line after its markdown opener, and leaves code and English alone', async ($, on) => {
    world(on, [prompt('שלום'), answer('תשובה')])
    await start($)
    const input = ['`/gpt` שולח את התשובה', '- **מה:** בדיקה', '## כותרת', 'plain English line', '```', 'קוד עברית', '```', '| עמודה | col |'].join('\n')
    const expected = [`${RLM}\`/gpt\` שולח את התשובה`, `- **${RLM}מה:** בדיקה`, `## ${RLM}כותרת`, 'plain English line', '```', 'קוד עברית', '```', `|${RLM} עמודה | col |`].join('\n')
    for (const surface of SURFACES) expect(await drawn($, surface, input), surface).toBe(expected)
  })

  test('leaves an English line with a Hebrew word in it as it is', async ($, on) => {
    world(on, [prompt('שלום'), answer('תשובה')])
    await start($)
    const input = 'Working on the new Hebrew course (קורס) today\nהקורס החדש (course) נפתח היום'
    expect(await drawn($, 'desktop', input)).toBe(`Working on the new Hebrew course (קורס) today\n${RLM}הקורס החדש (course) נפתח היום`)
  })

  test('the direction button flips Hebrew lines to the left and back, and the side is kept', async ($, on) => {
    const w = world(on, [prompt('שלום'), answer('תשובה')])
    await start($)
    const band = await mountBand($, 'desktop')
    expect((await band.find({ key: 'direction' }))?.text).toBe('⇄ Left')
    await band.press({ key: 'direction' })
    expect((await band.find({ key: 'direction' }))?.text).toBe('⇄ Right')
    expect(w.store.get('direction')).toBe('ltr')
    expect(await drawn($, 'desktop', 'Claude Code הוא הכלי שלי\nשורה בעברית')).toBe(`${LRM}Claude Code הוא הכלי שלי\n${LRM}שורה בעברית`)
    await band.press({ key: 'direction' })
    expect((await band.find({ key: 'direction' }))?.text).toBe('⇄ Left')
    expect(w.store.get('direction')).toBe('rtl')
    expect(await drawn($, 'desktop', 'Claude Code הוא הכלי שלי\nשורה בעברית')).toBe(`${RLM}Claude Code הוא הכלי שלי\n${RLM}שורה בעברית`)
    await band.unmount()
  })

  test('a session starts on the side chosen last time', async ($, on) => {
    const w = world(on, [prompt('שלום'), answer('תשובה')])
    w.store.set('direction', 'ltr')
    await start($)
    expect(await drawn($, 'terminal', 'שורה בעברית')).toBe(`${LRM}שורה בעברית`)
  })
})

describe('the buttons above the prompt', () => {
  test('shows in every session, even an English one with nothing to translate, and keeps the row beneath', async ($, on) => {
    world(on, [prompt('hello'), answer('short reply')])
    await start($)
    for (const surface of SURFACES) {
      const band = await mountBand($, surface)
      if (surface === 'desktop') {
        // The desktop draws the row as one image (the tile) and the buttons; no words beside them.
        const tree = JSON.stringify(await band.drawn())
        expect(tree).toContain('"type":"Svg"')
        expect(tree).not.toContain('מיושר')
        expect(tree).not.toContain('"hotkey"')
      }
      expect((await band.find({ key: 'direction' }))?.text, surface).toBe('⇄ Left')
      expect(await band.find({ key: 'translate' }), surface).toBeUndefined()
      expect(await band.find({ key: 'engine-band' }), surface).toBeDefined()
      await band.unmount()
    }
  })

  test('a reply in English that arrives mid-session brings the Translate button when the turn ends', async ($, on) => {
    const w = world(on, [prompt('שלום'), answer('תשובה')])
    await start($)
    const band = await mountBand($, 'desktop')
    expect(await band.find({ key: 'translate' })).toBeUndefined()
    w.rows = [...w.rows, prompt('תכתוב דוח'), answer(ENGLISH)]
    await ($ as never as { turn: { complete: (e: never) => Promise<unknown> } }).turn.complete({ reason: 'answer', answer: '', durationMs: 1, isAborted: false, turnId: 't2' } as never)
    expect((await band.find({ key: 'translate' }))?.text).toBe('Translate to Hebrew')
    await band.unmount()
  })

  test('offers to translate the last English reply even a couple of replies back', async ($, on) => {
    world(on, [prompt('תכתוב דוח'), answer(ENGLISH), prompt('ועכשיו בעברית'), answer('הנה זה בעברית')])
    await start($)
    for (const surface of SURFACES) {
      const band = await mountBand($, surface)
      if (surface === 'desktop') {
        const tree = JSON.stringify(await band.drawn())
        expect(tree).not.toContain('התשובה האחרונה')
        expect(tree).not.toContain('"variant":"primary"')
      }
      expect((await band.find({ key: 'translate' }))?.text, surface).toBe('Translate to Hebrew')
      // The engine's own row stays under it.
      expect(await band.find({ key: 'engine-band' }), surface).toBeDefined()
      await band.unmount()
    }
  })
})

describe('translate', () => {
  test('swaps the English block for Hebrew on screen, takes the dash out, and switches back and forth', async ($, on) => {
    const w = world(on, [prompt('תסביר לי'), answer(ENGLISH)])
    await start($)
    const band = await mountBand($, 'desktop')
    expect(await band.find({ key: 'original' })).toBeUndefined()
    await band.press({ key: 'translate' })
    expect(w.completes).toEqual([ENGLISH])
    expect(await drawn($, 'desktop', ENGLISH)).toBe(RLM + TRANSLATED)
    expect(w.toasts.some(t => t.startsWith('Translation ready'))).toBe(true)
    expect(await band.find({ key: 'translate' })).toBeUndefined()

    expect((await band.find({ key: 'original' }))?.text).toBe('↩ Original')
    await band.press({ key: 'original' })
    expect(await drawn($, 'desktop', ENGLISH)).toBe(ENGLISH)
    expect((await band.find({ key: 'hebrew' }))?.text).toBe('Show Hebrew')
    await band.press({ key: 'hebrew' })
    expect(await drawn($, 'terminal', ENGLISH)).toBe(RLM + TRANSLATED)
    await band.unmount()
  })

  test('an older translation can still go back to the original when a newer English reply is waiting', async ($, on) => {
    const w = world(on, [prompt('תסביר לי'), answer(ENGLISH)])
    await start($)
    const band = await mountBand($, 'desktop')
    await band.press({ key: 'translate' })
    w.rows = [...w.rows, prompt('ועוד אחד'), answer(ENGLISH_2)]
    await start($)
    expect((await band.find({ key: 'translate' }))?.text).toBe('Translate to Hebrew')
    expect((await band.find({ key: 'original' }))?.text).toBe('↩ Original')
    await band.press({ key: 'original' })
    expect(await drawn($, 'desktop', ENGLISH)).toBe(ENGLISH)
    await band.unmount()
  })

  test('translates every English block of that reply, past tool results and reminders', async ($, on) => {
    const w = world(on, [prompt('<system-reminder>context</system-reminder>\nתבדוק את זה'), answer(ENGLISH), toolResult(), answer(ENGLISH_2)])
    await start($)
    const band = await mountBand($, 'desktop')
    await band.press({ key: 'translate' })
    expect([...w.completes].sort()).toEqual([ENGLISH, ENGLISH_2].sort())
    await band.unmount()
  })

  test('a failed translation says so, leaves the English, and the button comes back', async ($, on) => {
    const w = world(on, [prompt('תסביר לי'), answer(ENGLISH)])
    w.reply = () => ({ isAnswered: false, reason: 'api-error', usage: { input_tokens: 0, output_tokens: 0 } })
    await start($)
    const band = await mountBand($, 'desktop')
    await band.press({ key: 'translate' })
    expect(w.toasts.some(t => t.startsWith('Translation failed'))).toBe(true)
    expect(await drawn($, 'desktop', ENGLISH)).toBe(ENGLISH)
    expect((await band.find({ key: 'translate' }))?.text).toBe('Translate to Hebrew')
    expect(await band.find({ key: 'original' })).toBeUndefined()
    await band.unmount()
  })
})

type Drawn = { type?: string; props?: { key?: string }; children?: unknown[] }
const nodeByKey = (node: unknown, key: string): Drawn | null => {
  if (node === null || typeof node !== 'object') return null
  const n = node as Drawn
  if (n.props?.key === key) return n
  for (const child of n.children ?? []) {
    const found = nodeByKey(child, key)
    if (found) return found
  }
  return null
}

describe('sharing Smart PreCompact\'s row', () => {
  test('on a desktop with room, the buttons ride in that row and no row of their own is drawn', async ($, on) => {
    world(on, [prompt('hello'), answer('short reply')], 'host')
    await start($)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 96 } as never })
    const tree = await band.drawn()
    const host = nodeByKey(tree, 'spc-band')
    const keys = (host?.children ?? []).map(child => (child as Drawn).props?.key)
    // The host's image and spacer, then this mod's tile, its button and a hairline, then the host's buttons.
    expect(keys).toEqual([undefined, undefined, undefined, 'direction', undefined, 'compact', 'hide'])
    expect(nodeByKey(tree, 'mods-row')).toBeNull()
    expect(JSON.stringify(host)).toContain('"alt":"Hebrew"')
    expect(JSON.stringify(tree)).not.toContain('"alt":"Hebrew","width":50')
  })

  test('with no room (a narrow window) the row draws on its own, above', async ($, on) => {
    world(on, [prompt('hello'), answer('short reply')], 'host')
    await start($)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 60 } as never })
    const tree = await band.drawn()
    expect((nodeByKey(tree, 'spc-band')?.children ?? []).length).toBe(4)
    expect(nodeByKey(tree, 'mods-row')).not.toBeNull()
    expect(await band.find({ key: 'direction' })).toBeDefined()
  })

  test('a terminal never shares: its row stays its own', async ($, on) => {
    world(on, [prompt('hello'), answer('short reply')], 'host')
    await start($)
    const band = await mountBand($, 'terminal')
    const tree = await band.drawn()
    expect((nodeByKey(tree, 'spc-band')?.children ?? []).length).toBe(4)
    expect(nodeByKey(tree, 'mods-row')).not.toBeNull()
  })
})

describe('the shared row', () => {
  test('alone it draws the shared row itself', async ($, on) => {
    world(on, [prompt('hello'), answer('short reply')])
    await start($)
    for (const surface of SURFACES) {
      const band = await mountBand($, surface)
      expect(nodeByKey(await band.drawn(), 'mods-row'), surface).not.toBeNull()
      await band.unmount()
    }
  })

  test('its buttons join another mod\'s shared row at its end, on both surfaces', async ($, on) => {
    world(on, [prompt('hello'), answer('short reply')], 'shared')
    await start($)
    for (const surface of SURFACES) {
      const band = await mountBand($, surface)
      const tree = await band.drawn()
      const keys = (nodeByKey(tree, 'mods-row')?.children ?? []).map(child => (child as Drawn).props?.key)
      expect(keys.slice(0, 2), surface).toEqual([undefined, 'copy-chat'])
      expect(keys.at(-1), surface).toBe('direction')
      expect(JSON.stringify(tree).split('"mods-row"').length - 1, surface).toBe(1)
      await band.unmount()
    }
  })
})
