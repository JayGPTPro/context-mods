// The Copy chat button: the transcript script, its fallbacks, and the button's seat in the shared row.
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const PLUGIN = 'copy-chat'
const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} }
type Engine = Parameters<TestBody>[0]

type Row = { role: 'user' | 'assistant'; text: string; toolUses: never[]; toolResults?: unknown[] }
const prompt = (text: string): Row => ({ role: 'user', text, toolUses: [] })
const answer = (text: string): Row => ({ role: 'assistant', text, toolUses: [] })

type Run = { argv: string[] }
type World = { rows: Row[]; toasts: string[]; runs: Run[]; copied: string | null; script: (argv: string[]) => { exitCode: number; stdout: string } }

const world = (on: On, rows: Row[], beneath: 'engine' | 'spc' = 'engine'): World => {
  const w: World = { rows, toasts: [], runs: [], copied: null, script: () => ({ exitCode: 0, stdout: '{"ok": true, "mine": 3, "claude": 2, "compacts": 1}\n' }) }
  on('session.messages', () => ({ value: w.rows as never }))
  on('session.id', () => ({ value: 'abc-123' as never }))
  on('session.cwd', () => ({ value: '/p' as never }))
  on('session.root', () => ({ value: '/p' as never }))
  on('process.run', (_, e) => {
    w.runs.push({ argv: [...e.argv] })
    return { value: { ...w.script([...e.argv]), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } as never }
  })
  on('ui.copy', (_, e) => {
    w.copied = e.text
    return { value: { isCopied: true } as never }
  })
  on('ui.toast', (_, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Button } = ui
    const image = 'Svg' in ui ? <ui.Svg source={'<svg xmlns="http://www.w3.org/2000/svg" width="190" height="26"></svg>'} alt="Smart PreCompact" width={190} height={26} /> : null
    if (beneath === 'engine') return <Box key="engine-band" />
    return (
      <Box key="spc-band" flexDirection="row" alignItems="center" gap={1}>
        {image}
        <Box flexGrow={1} />
        <Button key="compact" label="Smart compact" onPress={() => undefined} />
      </Box>
    )
  })
  return w
}

const band = ($: Engine, surface: 'desktop' | 'terminal' = 'desktop') =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND as never })

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

describe('copy the conversation', () => {
  test('the transcript script copies it, and the toast says what went', async ($, on) => {
    const w = world(on, [prompt('hello'), answer('short reply')])
    for (const surface of ['desktop', 'terminal'] as const) {
      const row = await band($, surface)
      await row.press({ key: 'copy-chat' })
      await row.unmount()
    }
    expect(w.runs[0]?.argv[0]).toBe('python3')
    expect(w.runs[0]?.argv[1]?.endsWith('/hooks/thread.py')).toBe(true)
    expect(w.runs[0]?.argv.slice(2)).toEqual(['abc-123', '/p', '/p'])
    // The script copied it itself: nothing goes through the app's copy.
    expect(w.copied).toBeNull()
    expect(w.toasts).toEqual([
      'Chat copied: 3 messages from you and 2 from Claude, 1 compact marked. Ready to paste',
      'Chat copied: 3 messages from you and 2 from Claude, 1 compact marked. Ready to paste',
    ])
  })

  test('where python3 is missing, python runs it', async ($, on) => {
    const w = world(on, [prompt('hello'), answer('short reply')])
    w.script = argv => (argv[0] === 'python3' ? { exitCode: 9009, stdout: '' } : { exitCode: 0, stdout: '{"ok": true, "mine": 1, "claude": 1, "compacts": 0}\n' })
    const row = await band($)
    await row.press({ key: 'copy-chat' })
    expect(w.runs.map(r => r.argv[0])).toEqual(['python3', 'python'])
    expect(w.toasts.at(-1)).toBe('Chat copied: 1 message from you and 1 from Claude. Ready to paste')
  })

  for (const why of ['no clipboard tool', 'the clipboard refused it']) {
    test(`when the script says "${why}", it prints the text and the app copies it`, async ($, on) => {
      const w = world(on, [prompt('hello'), answer('short reply')])
      w.script = argv =>
        argv.includes('--print')
          ? { exitCode: 0, stdout: '{"ok": true, "mine": 1, "claude": 1, "compacts": 0}\nMe (Oct 6 12:00): hello\n\nClaude (12:01): short reply\n' }
          : { exitCode: 0, stdout: `{"ok": false, "why": "${why}"}\n` }
      const row = await band($)
      await row.press({ key: 'copy-chat' })
      expect(w.copied).toBe('Me (Oct 6 12:00): hello\n\nClaude (12:01): short reply')
      expect(w.toasts.at(-1)).toBe('Chat copied: 1 message from you and 1 from Claude. Ready to paste')
    })
  }

  test('an empty chat says so', async ($, on) => {
    const w = world(on, [])
    w.script = () => ({ exitCode: 0, stdout: '{"ok": false, "why": "nothing to copy yet"}\n' })
    const row = await band($)
    await row.press({ key: 'copy-chat' })
    expect(w.toasts.at(-1)).toBe('Nothing to copy in this chat yet')
  })

  test('without Python, the rows are copied clean: names, a compact line, nothing else', async ($, on) => {
    const toolOutput: Row = { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't1', text: 'TOOL OUTPUT HERE', isError: false }] }
    const w = world(on, [
      prompt('This session is being continued from a previous conversation that ran out of context. Summary...'),
      prompt('What happened?'),
      answer('First I checked the logs.'),
      toolOutput,
      answer('The deploy failed on a missing key.'),
      prompt('<system-reminder>a note for the model</system-reminder>\nHow do I fix it? [Image: source: /tmp/x.png]'),
      answer('Add the key in Settings.'),
    ])
    w.script = () => ({ exitCode: 127, stdout: '' })
    const row = await band($)
    await row.press({ key: 'copy-chat' })
    expect(w.copied).toBe(
      [
        '[Conversation compacted here]',
        'Me: What happened?',
        'Claude: First I checked the logs.\n\nThe deploy failed on a missing key.',
        'Me: How do I fix it? [image]',
        'Claude: Add the key in Settings.',
      ].join('\n\n'),
    )
    expect(w.toasts.at(-1)).toBe('Chat copied without times: 2 messages from you and 2 from Claude. Ready to paste')
  })
})

describe('the shared row', () => {
  test('alone, it draws the shared row itself, the row beneath kept under it', async ($, on) => {
    world(on, [])
    for (const surface of ['desktop', 'terminal'] as const) {
      const row = await band($, surface)
      const tree = await row.drawn()
      expect(labels(nodeByKey(tree, 'mods-row')), surface).toEqual(['Box', 'Copy chat'])
      expect(nodeByKey(tree, 'engine-band'), surface).not.toBeNull()
      await row.unmount()
    }
  })

  test('on the desktop it rides in Smart PreCompact\'s row; in a terminal it keeps its own', async ($, on) => {
    world(on, [], 'spc')
    const desktop = await band($)
    expect(labels(nodeByKey(await desktop.drawn(), 'spc-band'))).toEqual(['Smart PreCompact', 'Box', 'Copy chat', '', 'Smart compact'])
    await desktop.unmount()
    const terminal = await band($, 'terminal')
    expect(labels(nodeByKey(await terminal.drawn(), 'mods-row'))).toEqual(['Box', 'Copy chat'])
    await terminal.unmount()
  })
})
