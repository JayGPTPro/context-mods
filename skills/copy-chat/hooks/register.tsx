// Copy chat: one button above the prompt puts the whole conversation on the clipboard, clean, for
// pasting into another chat: "Dana (12:01): ..." and "Claude (12:03): ...", a line where it was
// compacted, and nothing else. thread.py reads the transcript file, which has every message's time
// and the messages from before a compact; a mod's own file read stops at 4 MiB and a long
// transcript is larger. Without Python the rows the session holds are copied, without times.
import type { EngineInterface, Register, RenderSurface, SessionMessage } from 'claude-code'

import { DIVIDER, ROW_KEY, buttonPx, seat } from './panel'

const LABEL = 'Copy chat'
const ME = 'Me'
const COMPACT_SUMMARY = /^This session is being continued from a previous conversation/
// Windows often has only `python`, and `python3` there can be a stub that opens the Store.
const PYTHONS = ['python3', 'python']

/** What the person typed, for a prompt row; null for tool results, reminders and notifications. */
const typed = (row: SessionMessage) => {
  if (row.role !== 'user' || (row.toolResults?.length ?? 0) > 0) return null
  const text = row.text.replace(/^(\s*<system-reminder>[\s\S]*?<\/system-reminder>)+/, '').trim()
  return text !== '' && !/^<(?!pasted_content)/.test(text) && !text.startsWith('Caveat:') ? text : null
}

/** A typed message as it reads in a paste: no reminder or paste tags, a word where an image was. */
const asSaid = (text: string) =>
  text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<\/?pasted_content[^>]*>/g, '')
    .replace(/\[Image[^\]\n]*\]/g, '[image]')
    .trim()

export const threadText = (rows: readonly SessionMessage[]) => {
  const parts: string[] = []
  let mine = 0
  let replies = 0
  let reply: string[] = []
  // One reply can be several assistant rows (text between tool calls): they read as one message.
  const endReply = () => {
    if (reply.length === 0) return
    parts.push(`Claude: ${reply.join('\n\n')}`)
    replies += 1
    reply = []
  }
  for (const row of rows) {
    if (row.role === 'assistant') {
      const text = row.text.trim()
      if (text !== '') reply.push(text)
      continue
    }
    const said = typed(row)
    if (said === null) continue
    endReply()
    if (COMPACT_SUMMARY.test(said)) {
      parts.push('[Conversation compacted here]')
      continue
    }
    parts.push(`${ME}: ${asSaid(said)}`)
    mine += 1
  }
  endReply()
  return { text: parts.join('\n\n'), mine, replies }
}

type Receipt = { ok: boolean; mine?: number; claude?: number; compacts?: number; why?: string }

/** thread.py's receipt line, and the text after it when asked to print; null when no Python ran it. */
const runScript = async ($: EngineInterface, args: string[]) => {
  for (const python of PYTHONS) {
    const ran = await $.process.run([python, `${$.plugin.root}/hooks/thread.py`, ...args], { timeoutMs: 60_000 }).catch(() => null)
    if (ran === null || ran.exitCode !== 0) continue
    const [first = '', ...rest] = ran.stdout.replace(/\r\n/g, '\n').split('\n')
    try {
      return { receipt: JSON.parse(first) as Receipt, text: rest.join('\n').replace(/\n$/, ''), isCut: ran.isStdoutTruncated }
    } catch {
      continue
    }
  }
  return null
}

const messages = (n: number) => `${n} ${n === 1 ? 'message' : 'messages'}`

const said = (r: Receipt) => {
  const compacts = r.compacts ? `, ${r.compacts === 1 ? '1 compact marked' : `${r.compacts} compacts marked`}` : ''
  return `Chat copied: ${messages(r.mine ?? 0)} from you and ${r.claude ?? 0} from Claude${compacts}. Ready to paste`
}

const copyThread = async ($: EngineInterface, surface?: RenderSurface) => {
  const id = await $.session.id()
  const cwd = await $.session.cwd()
  const root = await $.session.root().catch(() => cwd)
  const ran = await runScript($, [id, cwd, root])
  if (ran?.receipt.ok) {
    $.ui.toast(said(ran.receipt))
    return
  }
  if (ran?.receipt.why === 'nothing to copy yet') {
    $.ui.toast('Nothing to copy in this chat yet')
    return
  }
  // No clipboard tool, or one that refused (a Linux box without xclip, or over SSH): the script
  // prints, the app copies.
  if (ran?.receipt.why === 'no clipboard tool' || ran?.receipt.why === 'the clipboard refused it') {
    const printed = await runScript($, [id, cwd, root, '--print'])
    if (printed?.receipt.ok && printed.text !== '') {
      const done = await $.ui.copy({ text: printed.text, surface })
      const cut = printed.isCut ? ' (cut at 4 MB: the chat is longer)' : ''
      $.ui.toast(done.isCopied ? `${said(printed.receipt)}${cut}` : 'Copy failed: this computer has no clipboard tool')
      return
    }
  }
  const thread = threadText(await $.session.messages())
  if (thread.mine + thread.replies === 0) {
    $.ui.toast('Nothing to copy in this chat yet')
    return
  }
  const done = await $.ui.copy({ text: thread.text, surface })
  $.ui.toast(
    done.isCopied
      ? `Chat copied without times: ${messages(thread.mine)} from you and ${thread.replies} from Claude. Ready to paste`
      : 'Copy failed',
  )
}

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const beneath = await next(e)
    const ui = $.ui.resolve(e)
    const { Box, Button } = ui
    const isDesktop = e.surface === 'desktop' && 'Svg' in ui
    const button = <Button key="copy-chat" label={LABEL} hotkey={isDesktop ? undefined : 'p'} onPress={press => copyThread($, press.surface)} />

    // The shared row, or Smart PreCompact's; with neither, this mod draws the shared row.
    const divider = isDesktop && 'Svg' in ui ? <ui.Svg source={DIVIDER} alt="" width={9} height={16} /> : null
    const placed = seat(beneath, [button], { px: buttonPx(LABEL), columns: e.props.bodyColumns, isDesktop, divider })
    if ('tree' in placed) return placed.tree
    return (
      <Box flexDirection="column">
        <Box key={ROW_KEY} flexDirection="row" alignItems="center" gap={1}>
          <Box flexGrow={1} />
          {placed.carry}
          {button}
        </Box>
        {placed.beneath}
      </Box>
    )
  })
}
