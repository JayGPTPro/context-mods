// The highlight, the one-sentence notification, the on/off button, and its seat in the shared row.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const PLUGIN = 'tldr'
const RLM = '‏'
const YELLOW = 'rgba(255, 213, 0, 0.28)'
const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} }
/** The engine's own drawing of a reply: one Text. */
const ENGINE = /^\{"type":"Text"/
type Engine = Parameters<TestBody>[0]

// A long Hebrew reply of six paragraphs; the model is told to mark 2 and 5.
const LONG = [
  '## מה עשיתי',
  'בדקתי את כל הקבצים בתיקייה ומצאתי שלושה מקומות שבהם הטופס שולח את הנתונים לכתובת הלא נכונה, ותיקנתי את שלושתם.',
  '```js\nconst a = 1\n\nconst b = 2\n```',
  'הסבר רקע ארוך על איך הטופס בנוי, מאיפה הוא מגיע ולמה הוא נכתב ככה מלכתחילה, שלא באמת משנה לך עכשיו בכלל. '.repeat(4),
  'מחכה לך: צריך אישור שלך לפני שאני דוחף את השינוי לאתר החי, כי זה משפיע על כל הלקוחות.',
  'עוד פסקה של פרטים טכניים שאפשר לדלג עליהם בלי לאבד כלום מהתמונה, כולל רשימה של כל השינויים בקוד. '.repeat(3),
].join('\n\n')

type Row = { role: 'user' | 'assistant'; text: string; toolUses: never[]; toolResults?: unknown[] }
const prompt = (text: string): Row => ({ role: 'user', text, toolUses: [] })
const answer = (text: string): Row => ({ role: 'assistant', text, toolUses: [] })

type Beneath = 'engine' | 'shared' | 'spc' | 'spc-over-shared' | 'spc-with-guest'
type World = { rows: Row[]; asked: { prompt: string; model: string }[]; reply: string; toasts: string[]; translates: boolean; asEngine: boolean; orients: boolean; gate: (() => Promise<void>) | null }

const world = (on: On, rows: Row[], beneath: Beneath = 'engine'): World => {
  const w: World = { rows, asked: [], toasts: [], translates: false, asEngine: false, orients: false, gate: null, reply: '{"tldr": "מחכה לך: אישור לפני דחיפה לאתר — החי", "marks": [2, 5]}' }
  on('session.messages', () => ({ value: w.rows as never }))
  on('model.complete', async (_, e) => {
    w.asked.push({ prompt: e.prompt, model: e.model })
    // A test that needs the model to take its time holds it here.
    if (w.gate) await w.gate()
    return { value: { isAnswered: true, text: w.reply, usage: { input_tokens: 1, output_tokens: 1 } } as never }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', (_, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Button } = ui
    const image = 'Svg' in ui ? <ui.Svg source={'<svg xmlns="http://www.w3.org/2000/svg" width="190" height="26"></svg>'} alt="Smart PreCompact" width={190} height={26} /> : null
    const shared = (
      <Box key="mods-row" flexDirection="row" alignItems="center" gap={1}>
        <Box flexGrow={1} />
        <Button key="other-mod" label="Other mod" onPress={() => undefined} />
      </Box>
    )
    const spc = (
      <Box key="spc-band" flexDirection="row" alignItems="center" gap={1}>
        {image}
        <Box flexGrow={1} />
        <Button key="compact" label="Smart compact" onPress={() => undefined} />
        <Button key="hide" label="Hide" onPress={() => undefined} />
      </Box>
    )
    if (beneath === 'engine') return <Box key="engine-band" />
    if (beneath === 'shared') return <Box key="engine-band" flexDirection="column">{shared}</Box>
    if (beneath === 'spc') return <Box key="spc-stack" flexDirection="column">{spc}</Box>
    // Smart PreCompact's row after an inner mod (another mod) took a seat in it, before its hairline.
    if (beneath === 'spc-with-guest') {
      return (
        <Box key="spc-stack" flexDirection="column">
          <Box key="spc-band" flexDirection="row" alignItems="center" gap={1}>
            {image}
            <Box flexGrow={1} />
            <Button key="other-mod" label="Other mod" onPress={() => undefined} />
            {'Svg' in ui ? <ui.Svg source={'<svg xmlns="http://www.w3.org/2000/svg" width="9" height="16"></svg>'} alt="" width={9} height={16} /> : null}
            <Button key="compact" label="Smart compact" onPress={() => undefined} />
            <Button key="hide" label="Hide" onPress={() => undefined} />
          </Box>
        </Box>
      )
    }
    // Smart PreCompact outer of a mod that drew the shared row: two rows, one under the other.
    return (
      <Box key="spc-stack" flexDirection="column">
        {spc}
        <Box flexDirection="column">{shared}</Box>
      </Box>
    )
  })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    // What reaches the hooks beneath (another mod, then the engine) is drawn marked, so a test sees
    // each paragraph went through them. A reply an inner mod would translate comes back other words.
    // The kit keeps no key on a bare Text: the engine's drawing is told by its type.
    // A mod beneath that draws the reply in other words (a translation) over the app's own drawing says
    // so with a node keyed `translated`; and one asked for a piece as markdown draws it that way itself,
    // with its own change to the text (a direction mark at the start, here).
    const { Box, Markdown } = $.ui.resolve(e)
    const asked = e.props as { asMarkdown?: unknown }
    if (w.orients && asked.asMarkdown === true) return <Markdown text={`${RLM}${e.props.text}`} />
    if (w.translates && w.asEngine && e.props.text === LONG) return <Box key="translated">{{ type: 'engine', ref: 1 } as never}</Box>
    if (w.translates && e.props.text === LONG) return <Text>TRANSLATED</Text>
    // What the real app answers: a reference to its own drawing, with none of the reply's words in it.
    if (w.asEngine) return { type: 'engine', ref: 1 } as never
    return <Text>{`DRAWN${e.props.isFirstOfReply ? '•' : ''}:${w.orients ? RLM : ''}${e.props.text}`}</Text>
  })
  return w
}

const start = ($: Engine) => ($ as never as { session: { start: (e: never) => Promise<unknown> } }).session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)

const finish = ($: Engine, agentId?: string) =>
  ($ as never as { turn: { complete: (e: never) => Promise<unknown> } }).turn.complete({
    reason: 'answer',
    answer: '',
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
    agentId,
  } as never)

const drawn = async ($: Engine, surface: 'desktop' | 'terminal', text: string) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } as never })
  const tree = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return tree
}

const band = ($: Engine, surface: 'desktop' | 'terminal' = 'desktop', bodyColumns = 120) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: { ...BAND, bodyColumns } as never })

type Drawn = { type?: string; props?: { key?: string; label?: string; alt?: string }; children?: unknown[] }
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
const labels = (row: Drawn | null) => (row?.children ?? []).map(c => (c as Drawn).props?.label ?? (c as Drawn).props?.alt ?? (c as Drawn).type)

describe('highlight', () => {
  test('a long reply gets its picked paragraphs on yellow, code and the rest left plain', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    expect(w.asked.length).toBe(1)
    expect(w.asked[0]?.model).toBe('haiku')
    expect(w.asked[0]?.prompt).toContain('[5]\nמחכה לך')

    const tree = await drawn($, 'desktop', LONG)
    // Two highlighted boxes, each holding one picked paragraph.
    expect(tree.split(YELLOW).length - 1).toBe(2)
    expect(tree).not.toMatch(ENGINE)
    // Every group goes to the hooks beneath; only the first carries the reply's bullet.
    expect(tree).toContain('DRAWN•:## מה עשיתי')
    expect(tree.split('DRAWN•').length - 1).toBe(1)
    expect(tree).toContain('DRAWN:מחכה לך: צריך אישור')
  })

  test('the highlight shows when the drawing beneath is the app\'s own (a reference with no words in it)', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    w.asEngine = true
    const tree = await drawn($, 'desktop', LONG)
    expect(tree.split(YELLOW).length - 1).toBe(2)
  })

  test('the whole reply stays on screen: the app draws one reference per reply, so the rest is drawn as markdown', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    w.asEngine = true
    const tree = await drawn($, 'desktop', LONG)
    // The app shows only the first of several references to its own drawing: the rest of the reply vanished.
    expect(tree.split('"type":"engine"').length - 1).toBeLessThanOrEqual(1)
    for (const words of ['מחכה לך: צריך אישור', 'עוד פסקה של פרטים טכניים', 'הסבר רקע ארוך']) expect(tree).toContain(words)
  })

  test('when a mod beneath draws the reply in other words (a translation), that drawing wins', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    w.translates = true
    const tree = await drawn($, 'desktop', LONG)
    expect(tree).toContain('TRANSLATED')
    expect(tree).not.toContain(YELLOW)
  })

  test('the model is shown the last message typed, so the sentence comes in that language', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [
      prompt('earlier question'),
      answer('short'),
      prompt('<system-reminder>for the model</system-reminder>\nFix the form please <pasted_content>pasted logs</pasted_content>'),
      answer(LONG),
    ])
    await start($)
    await clock.settle()
    const sent = w.asked[0]?.prompt ?? ''
    expect(sent).toContain('<<<Fix the form please>>>')
    expect(sent).not.toContain('pasted logs')
    expect(sent).not.toContain('earlier question')
  })

  test('the sentence comes up as a notification, without the dash the model slipped in', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    expect(w.toasts).toContain('מחכה לך: אישור לפני דחיפה לאתר, החי')
    const row = await band($)
    expect((await row.find({ key: 'tldr-off' }))?.text).toBe('↩ No TL;DR')
    expect(await row.find({ key: 'engine-band' })).toBeDefined()
    await row.unmount()
  })

  test('a short reply is never sent to the model and leaves no notification', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('מה השעה'), answer('השעה שלוש.')])
    await start($)
    await finish($)
    await clock.settle()
    expect(w.asked.length).toBe(0)
    expect(w.toasts).toEqual([])
  })

  test('a turn that was stopped or failed is not read', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer('קצר.')])
    await start($)
    await clock.settle()
    w.rows = [...w.rows, prompt('ועוד'), answer(LONG)]
    for (const reason of ['aborted', 'error']) {
      await ($ as never as { turn: { complete: (e: never) => Promise<unknown> } }).turn.complete({ reason, answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1' } as never)
    }
    await clock.settle()
    expect(w.asked.length).toBe(0)
  })

  test('a subagent finishing does not trigger it', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await clock.settle()
    // Read once on load; a subagent finishing adds no second read.
    expect(w.asked.length).toBe(1)
    w.rows = [...w.rows, prompt('ועוד'), answer(LONG + '\n\nעוד שורה')]
    await finish($, 'agent-1')
    await clock.settle()
    expect(w.asked.length).toBe(1)
  })

  test('the terminal keeps its own drawing', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    expect(await drawn($, 'terminal', LONG)).toMatch(ENGINE)
  })

  test('never highlights more than the cap, even when the model asks for everything', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    w.reply = '{"tldr": "הכל", "marks": [1, 2, 3, 4, 5, 6]}'
    await start($)
    await finish($)
    await clock.settle()
    const tree = await drawn($, 'desktop', LONG)
    // The heading (1) and the code block (3) are never picked; the long background (4) breaks the share cap.
    expect(tree.split(YELLOW).length - 1).toBe(2)
  })
})

describe('with a mod beneath', () => {
  test('a translation drawn beneath over the app\'s own drawing wins, and nothing is highlighted', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    w.translates = true
    w.asEngine = true
    const tree = await drawn($, 'desktop', LONG)
    expect(tree).toContain('"translated"')
    expect(tree).not.toContain(YELLOW)
    expect(tree.split('"type":"engine"').length - 1).toBe(1)
  })

  test('every piece past the first goes through the mod beneath, so its direction mark is kept on them', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    w.orients = true
    const tree = await drawn($, 'desktop', LONG)
    expect(tree.split(YELLOW).length - 1).toBe(2)
    // The first piece: the app's own drawing with the reply's bullet. The rest: markdown the mod beneath
    // drew, each piece opening with its mark.
    expect(tree).toContain(`DRAWN•:${RLM}## מה עשיתי`)
    expect(tree).toContain(`"text":"${RLM}מחכה לך: צריך אישור`)
    expect(tree).toContain(`"text":"${RLM}עוד פסקה`)
    expect(tree).not.toContain('"text":"מחכה לך')
  })

  test('with no mod beneath, the pieces past the first are drawn as markdown and one reference stays', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    w.asEngine = true
    const tree = await drawn($, 'desktop', LONG)
    expect(tree.split('"type":"engine"').length - 1).toBe(1)
    expect(tree).toContain('"type":"Markdown"')
    expect(tree).toContain('מחכה לך: צריך אישור')
  })
})

describe('which paragraphs are marked', () => {
  test('a paragraph marked once is not yellow in a later reply the model never picked it in', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    const waiting = 'מחכה לך: צריך אישור שלך לפני שאני דוחף את השינוי לאתר החי, כי זה משפיע על כל הלקוחות.'
    expect(await drawn($, 'desktop', waiting)).toContain(YELLOW)
    // The next reply is short and repeats that line: the model never reads it, so it is plain.
    const short = `סיימתי.\n\n${waiting}`
    w.rows = [...w.rows, prompt('ועכשיו?'), answer(short)]
    await finish($)
    await clock.settle()
    expect(w.asked.length).toBe(1)
    expect(await drawn($, 'desktop', short)).not.toContain(YELLOW)
    // And a long reply the model reads again marks only what it picks this time.
    w.rows = [...w.rows, prompt('ועוד'), answer(LONG)]
    w.reply = '{"tldr": "הכל טוב", "marks": [2]}'
    await finish($)
    await clock.settle()
    expect(w.asked.length).toBe(2)
    expect((await drawn($, 'desktop', LONG)).split(YELLOW).length - 1).toBe(1)
  })

  test('a slash command between two replies keeps them apart', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [
      prompt('fix the form'),
      answer(LONG),
      prompt('<command-name>/model</command-name>\n<command-message>model</command-message>'),
      prompt('<local-command-stdout>Set model to opus</local-command-stdout>'),
      answer('Done.'),
    ])
    await start($)
    await clock.settle()
    // The reply after the command is short: nothing is read, nothing is sent.
    expect(w.asked.length).toBe(0)
  })

  test('the model\'s JSON is read even when words with braces follow it', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    w.reply = '{"tldr": "מחכה לך: אישור", "marks": [2]}\nNote: {done}'
    await start($)
    await finish($)
    await clock.settle()
    expect(w.toasts).toContain('מחכה לך: אישור')
  })

  test('two triggers close together read the reply once', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await Promise.all([finish($), finish($)])
    await clock.settle()
    expect(w.asked.length).toBe(1)
  })

  test('turned off while the model reads: the marks wait for the button, no sentence shows, no second call', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    let release: (() => void) | null = null
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    w.gate = () =>
      new Promise<void>(resolve => {
        release = resolve
      })
    await start($)
    const reading = finish($)
    const row = await band($)
    await row.press({ key: 'tldr-off' })
    w.gate = null
    release?.()
    await reading
    await clock.settle()
    expect(w.toasts).toEqual([])
    expect(await drawn($, 'desktop', LONG)).toMatch(ENGINE)
    await row.press({ key: 'tldr-on' })
    await clock.settle()
    expect(w.asked.length).toBe(1)
    expect(await drawn($, 'desktop', LONG)).toContain(YELLOW)
    await row.unmount()
  })
})

describe('paragraphs', () => {
  test('a tilde line inside a backtick block does not end it, and an indented paragraph stays with its list item', async ($, on) => {
    mock.clock(on)
    mock.store(on)
    world(on, [prompt('hi'), answer('short.')])
    await start($)
    const { paragraphs } = await import('../hooks/register')
    expect(paragraphs('```\n~~~\n```\n\nאחרי')).toEqual(['```\n~~~\n```', 'אחרי'])
    expect(paragraphs('1. step\n\n    - detail\n\n2. step')).toEqual(['1. step\n\n    - detail', '2. step'])
  })
})

describe('the on/off button', () => {
  test('turning it off draws the reply plain, skips the model, and is kept for the next session', async ($, on) => {
    const clock = mock.clock(on)
    const saved = new Map<string, unknown>()
    on('store.get', (_, e) => ({ value: saved.get(e.key) as never }))
    on('store.set', (_, e) => {
      saved.set(e.key, e.value)
      return { value: undefined }
    })
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    const row = await band($)
    await row.press({ key: 'tldr-off' })
    expect(saved.get('isOn')).toBe(false)
    expect(await drawn($, 'desktop', LONG)).toMatch(ENGINE)
    expect((await row.find({ key: 'tldr-on' }))?.text).toBe('TL;DR')

    await finish($)
    await clock.settle()
    expect(w.asked.length).toBe(1)

    await row.press({ key: 'tldr-on' })
    expect(saved.get('isOn')).toBe(true)
    expect(await drawn($, 'desktop', LONG)).not.toMatch(ENGINE)
    await row.unmount()
  })

  test('a session starts off when it was turned off last time', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on, { isOn: false })
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await finish($)
    await clock.settle()
    expect(w.asked.length).toBe(0)
    const row = await band($)
    expect((await row.find({ key: 'tldr-on' }))?.text).toBe('TL;DR')
    await row.unmount()
  })

  test('a reload reads the last reply on load, so the reply it landed on is still marked', async ($, on) => {
    const clock = mock.clock(on)
    mock.store(on)
    const w = world(on, [prompt('תתקן את הטופס'), answer(LONG)])
    await start($)
    await clock.settle()
    expect(w.asked.length).toBe(1)
    expect(await drawn($, 'desktop', LONG)).toContain(YELLOW)
  })
})

describe('the shared row', () => {
  test('alone, it draws the shared row itself, with the row beneath kept under it', async ($, on) => {
    mock.clock(on)
    mock.store(on)
    world(on, [prompt('hi'), answer('short.')])
    await start($)
    for (const surface of ['desktop', 'terminal'] as const) {
      const row = await band($, surface)
      const tree = await row.drawn()
      expect(labels(nodeByKey(tree, 'mods-row')), surface).toEqual(['Box', '↩ No TL;DR'])
      expect(nodeByKey(tree, 'engine-band'), surface).not.toBeNull()
      await row.unmount()
    }
  })

  test('another mod\'s shared row beneath takes the button at its end, on both surfaces', async ($, on) => {
    mock.clock(on)
    mock.store(on)
    world(on, [prompt('hi'), answer('short.')], 'shared')
    await start($)
    for (const surface of ['desktop', 'terminal'] as const) {
      const row = await band($, surface)
      const tree = await row.drawn()
      expect(labels(nodeByKey(tree, 'mods-row')), surface).toEqual(['Box', 'Other mod', '↩ No TL;DR'])
      expect(JSON.stringify(tree).split('"mods-row"').length - 1, surface).toBe(1)
      await row.press({ key: 'tldr-off' })
      expect((await row.find({ key: 'tldr-on' }))?.text, surface).toBe('TL;DR')
      await row.press({ key: 'tldr-on' })
      await row.unmount()
    }
  })

  test('on the desktop it rides in Smart PreCompact\'s row, before its buttons, after a hairline', async ($, on) => {
    mock.clock(on)
    mock.store(on)
    world(on, [prompt('hi'), answer('short.')], 'spc')
    await start($)
    const row = await band($)
    const tree = await row.drawn()
    expect(labels(nodeByKey(tree, 'spc-band'))).toEqual(['Smart PreCompact', 'Box', '↩ No TL;DR', '', 'Smart compact', 'Hide'])
    expect(nodeByKey(tree, 'mods-row')).toBeNull()
    await row.unmount()
  })

  test('with Smart PreCompact over a shared row, it folds that row into Smart PreCompact\'s', async ($, on) => {
    mock.clock(on)
    mock.store(on)
    world(on, [prompt('hi'), answer('short.')], 'spc-over-shared')
    await start($)
    const row = await band($)
    const tree = await row.drawn()
    expect(labels(nodeByKey(tree, 'spc-band'))).toEqual(['Smart PreCompact', 'Box', 'Other mod', '↩ No TL;DR', '', 'Smart compact', 'Hide'])
    expect(nodeByKey(tree, 'mods-row')).toBeNull()
    await row.unmount()
  })

  test('a narrow window, or a terminal, leaves Smart PreCompact\'s row alone', async ($, on) => {
    mock.clock(on)
    mock.store(on)
    world(on, [prompt('hi'), answer('short.')], 'spc-over-shared')
    await start($)
    const narrow = await band($, 'desktop', 50)
    expect(labels(nodeByKey(await narrow.drawn(), 'spc-band'))).toEqual(['Smart PreCompact', 'Box', 'Smart compact', 'Hide'])
    expect(labels(nodeByKey(await narrow.drawn(), 'mods-row'))).toEqual(['Box', 'Other mod', '↩ No TL;DR'])
    await narrow.unmount()
    const terminal = await band($, 'terminal')
    // A terminal draws no image: the stand-in's Svg reads as a Box there.
    expect(labels(nodeByKey(await terminal.drawn(), 'spc-band')).slice(2)).toEqual(['Smart compact', 'Hide'])
    expect(labels(nodeByKey(await terminal.drawn(), 'mods-row'))).toEqual(['Box', 'Other mod', '↩ No TL;DR'])
    await terminal.unmount()
  })

  test('with no room left in Smart PreCompact\'s row, the buttons already there come out with it to one shared row', async ($, on) => {
    mock.clock(on)
    mock.store(on)
    world(on, [prompt('hi'), answer('short.')], 'spc-with-guest')
    await start($)
    const roomy = await band($, 'desktop', 120)
    expect(labels(nodeByKey(await roomy.drawn(), 'spc-band'))).toEqual(['Smart PreCompact', 'Box', 'Other mod', '↩ No TL;DR', '', 'Smart compact', 'Hide'])
    await roomy.unmount()
    const tight = await band($, 'desktop', 70)
    const tree = await tight.drawn()
    expect(labels(nodeByKey(tree, 'spc-band'))).toEqual(['Smart PreCompact', 'Box', 'Smart compact', 'Hide'])
    expect(labels(nodeByKey(tree, 'mods-row'))).toEqual(['Box', 'Other mod', '↩ No TL;DR'])
    await tight.unmount()
  })
})
