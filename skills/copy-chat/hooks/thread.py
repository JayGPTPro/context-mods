#!/usr/bin/env python3
"""Copies a Claude Code conversation to the clipboard as clean text, for pasting into another chat.

    Dana (Oct 6 12:01): what you wrote
    Claude (12:03): what Claude wrote

Each message carries its time (this computer's time zone; the date too on the first one and when
the day changes), and a line marks where the conversation was compacted. Nothing else: no
summaries, no tool calls or their output, no reminders or notices. Your name is the first word of
the name on your Claude account, else "Me".

Reads the session's transcript file (~/.claude/projects/<project>/<session id>.jsonl), which keeps
every message with its time, the ones from before a compact included. A mod's own file read stops
at 4 MiB and a long session's transcript is larger, so the copy-chat mod runs this.

Usage:
    thread.py <session id> <cwd> [<root>] [--print]
    thread.py --latest <cwd> [--print]     the newest conversation of that folder (for the skill)
Prints one JSON line: {"ok": true, "mine": N, "claude": N, "compacts": N} or {"ok": false, "why": "..."}.
--print writes the text to stdout after the JSON line instead of copying it.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime

CLAUDE = 'Claude'
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
REMINDER = re.compile(r'<system-reminder>.*?</system-reminder>', re.S)
PASTED = re.compile(r'</?pasted_content[^>]*>')
IMAGE = re.compile(r'\[Image[^\]\n]*\]')
SHOT = '[image]'


def config_dir():
    return os.environ.get('CLAUDE_CONFIG_DIR') or os.path.expanduser('~/.claude')


def my_name():
    """The first word of the name on the Claude account, else "Me"."""
    custom = os.environ.get('CLAUDE_CONFIG_DIR')
    path = os.path.join(custom, '.claude.json') if custom else os.path.expanduser('~/.claude.json')
    try:
        with open(path, encoding='utf-8') as handle:
            account = json.load(handle).get('oauthAccount') or {}
        words = str(account.get('displayName') or '').split()
        return words[0] if words else 'Me'
    except Exception:
        return 'Me'


def project_dir(cwd):
    return os.path.join(config_dir(), 'projects', re.sub(r'[^A-Za-z0-9]', '-', cwd))


def transcript(session_id, cwds):
    for cwd in cwds:
        path = os.path.join(project_dir(cwd), f'{session_id}.jsonl')
        if os.path.exists(path):
            return path
    found = glob.glob(os.path.join(config_dir(), 'projects', '*', f'{session_id}.jsonl'))
    return found[0] if found else None


def latest(cwds):
    """The conversation of that folder written to last: the one running now, when a skill asks."""
    for cwd in cwds:
        found = glob.glob(os.path.join(project_dir(cwd), '*.jsonl'))
        if found:
            return max(found, key=os.path.getmtime)
    return None


def local(stamp):
    return datetime.fromisoformat(stamp.replace('Z', '+00:00')).astimezone()


def typed(content):
    """What a person typed in a user entry, or None for tool output, commands and notices."""
    images = 0
    if isinstance(content, str):
        text = content
    else:
        if any(block.get('type') == 'tool_result' for block in content):
            return None
        text = '\n'.join(block.get('text', '') for block in content if block.get('type') == 'text')
        images = sum(1 for block in content if block.get('type') == 'image')
    text = PASTED.sub('', REMINDER.sub('', text))
    text = IMAGE.sub(SHOT, text).strip()
    # Slash commands, their output and the app's own notices all open with a tag or a bracket.
    if text.startswith('<') or text.startswith('Caveat:') or text.startswith('[Request interrupted'):
        return None
    if images and SHOT not in text:
        text = f'{text}\n{SHOT}'.strip()
    return text or None


def entries(path):
    """(kind, time, text) in order: kind is 'me', 'claude' or 'compact'."""
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if row.get('isSidechain') or row.get('isMeta') or row.get('isCompactSummary'):
                continue
            kind, stamp = row.get('type'), row.get('timestamp')
            if not stamp:
                continue
            if kind == 'user':
                text = typed((row.get('message') or {}).get('content', ''))
                if text:
                    yield 'me', stamp, text
            elif kind == 'attachment':
                # A message sent while Claude was working reaches the conversation this way.
                extra = row.get('attachment') or {}
                if extra.get('type') == 'queued_command' and (extra.get('origin') or {}).get('kind') == 'human':
                    text = typed(extra.get('prompt') or '')
                    if text:
                        yield 'me', stamp, text
            elif kind == 'assistant':
                blocks = (row.get('message') or {}).get('content') or []
                text = '\n\n'.join(b.get('text', '').strip() for b in blocks if isinstance(b, dict) and b.get('type') == 'text').strip()
                if text:
                    yield 'claude', stamp, text
            elif kind == 'system' and row.get('subtype') == 'compact_boundary':
                yield 'compact', stamp, ''


def render(path, me):
    parts, day, counts = [], None, {'me': 0, 'claude': 0, 'compact': 0}
    reply = None  # Claude's reply so far: [time, [texts]]; one reply is several entries

    def when(stamp):
        nonlocal day
        moment = local(stamp)
        label = f'{moment.hour:02d}:{moment.minute:02d}'
        today = f'{MONTHS[moment.month - 1]} {moment.day}'
        if today != day:
            day = today
            return f'{today} {label}'
        return label

    def end_reply():
        nonlocal reply
        if reply:
            parts.append(f'{CLAUDE} ({reply[0]}): ' + '\n\n'.join(reply[1]))
            counts['claude'] += 1
            reply = None

    for kind, stamp, text in entries(path):
        if kind == 'claude':
            if reply is None:
                reply = [when(stamp), []]
            reply[1].append(text)
            continue
        end_reply()
        if kind == 'compact':
            parts.append(f'[Conversation compacted here, {when(stamp)}]')
            counts['compact'] += 1
        else:
            parts.append(f'{me} ({when(stamp)}): {text}')
            counts['me'] += 1
    end_reply()
    return '\n\n'.join(parts), counts


def clipboard_command():
    """This computer's clipboard tool, or None."""
    if sys.platform == 'darwin' and shutil.which('pbcopy'):
        return ['pbcopy']
    if sys.platform.startswith('win'):
        shell = shutil.which('powershell') or shutil.which('pwsh')
        if shell:
            script = '[Console]::InputEncoding=[Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())'
            return [shell, '-NoProfile', '-Command', script]
        return None
    if os.environ.get('WAYLAND_DISPLAY') and shutil.which('wl-copy'):
        return ['wl-copy']
    if shutil.which('xclip'):
        return ['xclip', '-selection', 'clipboard']
    if shutil.which('xsel'):
        return ['xsel', '--clipboard', '--input']
    return None


def main(argv):
    printing = '--print' in argv
    newest = '--latest' in argv
    args = [a for a in argv if a not in ('--print', '--latest')]
    # A skill's ${CLAUDE_SESSION_ID} that reached here unfilled: the newest conversation instead.
    if args and args[0].startswith('${'):
        newest, args = True, args[1:]
    if newest:
        path = latest(args or [os.getcwd()])
    elif args:
        path = transcript(args[0], args[1:])
    else:
        return {'ok': False, 'why': 'no session id'}, None
    if not path:
        return {'ok': False, 'why': 'the conversation file was not found'}, None
    text, counts = render(path, my_name())
    if counts['me'] + counts['claude'] == 0:
        return {'ok': False, 'why': 'nothing to copy yet'}, None
    receipt = {'ok': True, 'mine': counts['me'], 'claude': counts['claude'], 'compacts': counts['compact']}
    if printing:
        return receipt, text
    command = clipboard_command()
    if command is None:
        return {'ok': False, 'why': 'no clipboard tool'}, None
    env = {**os.environ, 'LANG': 'en_US.UTF-8', 'LC_ALL': 'en_US.UTF-8'}
    try:
        # Output to nowhere: xclip and wl-copy stay behind to serve the clipboard, holding any pipe open.
        copied = subprocess.run(command, input=text.encode('utf-8'), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
    except Exception:
        return {'ok': False, 'why': 'no clipboard tool'}, None
    if copied.returncode != 0:
        return {'ok': False, 'why': 'the clipboard refused it'}, None
    return receipt, None


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    result, body = main(sys.argv[1:])
    print(json.dumps(result, ensure_ascii=False))
    if body is not None:
        print(body)
