"""thread.py on a small transcript holding every kind of row it meets. Run: python3 tests/test_thread.py"""
import json
import re
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, '..', 'hooks', 'thread.py')

ROWS = [
    {'type': 'user', 'timestamp': '2026-10-06T09:00:00Z', 'message': {'content': 'Hi, check the bug'}},
    {'type': 'assistant', 'timestamp': '2026-10-06T09:01:00Z', 'message': {'content': [{'type': 'text', 'text': 'Checking.'}, {'type': 'tool_use', 'name': 'Bash'}]}},
    {'type': 'user', 'timestamp': '2026-10-06T09:01:05Z', 'message': {'content': [{'type': 'tool_result', 'content': 'TOOL OUTPUT'}]}},
    {'type': 'attachment', 'timestamp': '2026-10-06T09:01:30Z', 'attachment': {'type': 'queued_command', 'prompt': 'and the logs too', 'origin': {'kind': 'human'}}},
    {'type': 'assistant', 'timestamp': '2026-10-06T09:02:00Z', 'message': {'content': [{'type': 'text', 'text': 'Found it.'}]}},
    {'type': 'assistant', 'timestamp': '2026-10-06T09:02:10Z', 'isSidechain': True, 'message': {'content': [{'type': 'text', 'text': 'SUBAGENT TEXT'}]}},
    {'type': 'user', 'timestamp': '2026-10-06T09:03:00Z', 'isMeta': True, 'message': {'content': 'Caveat: META'}},
    {'type': 'user', 'timestamp': '2026-10-06T09:04:00Z', 'message': {'content': '<command-name>/compact</command-name>'}},
    {'type': 'system', 'subtype': 'compact_boundary', 'timestamp': '2026-10-06T09:05:00Z'},
    {'type': 'user', 'timestamp': '2026-10-06T09:05:01Z', 'isCompactSummary': True, 'message': {'content': 'This session is being continued... SUMMARY'}},
    {'type': 'user', 'timestamp': '2026-10-07T06:30:00Z', 'message': {'content': [{'type': 'image'}, {'type': 'text', 'text': '<system-reminder>REMINDER</system-reminder>this is how it looks'}]}},
    {'type': 'assistant', 'timestamp': '2026-10-07T06:31:00Z', 'message': {'content': [{'type': 'text', 'text': 'Looks right.'}]}},
]


def expected(me):
    return '\n\n'.join([
        f'{me} (Oct 6 12:00): Hi, check the bug',
        'Claude (12:01): Checking.',
        f'{me} (12:01): and the logs too',
        'Claude (12:02): Found it.',
        '[Conversation compacted here, 12:05]',
        f'{me} (Oct 7 09:30): this is how it looks\n[image]',
        'Claude (09:31): Looks right.',
    ])


def run(home, *args):
    # USERPROFILE too: Python on Windows finds ~ there and ignores HOME.
    env = {**os.environ, 'HOME': home, 'USERPROFILE': home, 'TZ': 'Asia/Jerusalem'}
    env.pop('CLAUDE_CONFIG_DIR', None)
    out = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, encoding='utf-8', env=env)
    receipt, _, body = out.stdout.partition('\n')
    return json.loads(receipt), body.rstrip('\n')


def copy_checks(home):
    """The clipboard path, with stand-in tools on PATH (pbcopy on a Mac, xclip on Linux)."""
    if sys.platform.startswith('win'):
        return
    tools = tempfile.mkdtemp()
    out = os.path.join(tools, 'clipboard.txt')
    for name in ('pbcopy', 'xclip'):
        path = os.path.join(tools, name)
        with open(path, 'w') as handle:
            # Like xclip, it stays behind after reading: a copy must not wait for it.
            handle.write(f'#!/bin/sh\ncat > "{out}"\n(sleep 4) &\nexit ${{FAKE_EXIT:-0}}\n')
        os.chmod(path, 0o755)
    env = {**os.environ, 'HOME': home, 'TZ': 'Asia/Jerusalem', 'PATH': f'{tools}:/usr/bin:/bin'}
    env.pop('CLAUDE_CONFIG_DIR', None)
    env.pop('WAYLAND_DISPLAY', None)
    started = time.time()
    done = subprocess.run([sys.executable, SCRIPT, 'sess-1', '/p'], capture_output=True, text=True, encoding='utf-8', env=env)
    assert time.time() - started < 3, 'the copy waited for the clipboard tool to exit'
    assert json.loads(done.stdout) == {'ok': True, 'mine': 3, 'claude': 3, 'compacts': 1}, done.stdout
    with open(out, encoding='utf-8') as handle:
        assert handle.read() == expected('Dana'), 'the clipboard got other text'
    refused = subprocess.run([sys.executable, SCRIPT, 'sess-1', '/p'], capture_output=True, text=True, encoding='utf-8', env={**env, 'FAKE_EXIT': '1'})
    assert json.loads(refused.stdout) == {'ok': False, 'why': 'the clipboard refused it'}, refused.stdout
    none = subprocess.run([sys.executable, SCRIPT, 'sess-1', '/p'], capture_output=True, text=True, encoding='utf-8', env={**env, 'PATH': '/nonexistent'})
    assert json.loads(none.stdout) == {'ok': False, 'why': 'no clipboard tool'}, none.stdout

    # CLAUDE_CONFIG_DIR moves both the transcripts and the account file.
    moved = tempfile.mkdtemp()
    os.makedirs(os.path.join(moved, 'projects', '-q'))
    with open(os.path.join(moved, 'projects', '-q', 's.jsonl'), 'w', encoding='utf-8') as handle:
        handle.write(json.dumps({'type': 'user', 'timestamp': '2026-10-08T09:00:00Z', 'message': {'content': 'moved'}}) + '\n')
    with open(os.path.join(moved, '.claude.json'), 'w', encoding='utf-8') as handle:
        json.dump({'oauthAccount': {'displayName': 'Noa'}}, handle)
    there = subprocess.run([sys.executable, SCRIPT, 's', '/q', '--print'], capture_output=True, text=True, encoding='utf-8', env={**env, 'CLAUDE_CONFIG_DIR': moved})
    assert there.stdout.split('\n', 1)[1].rstrip('\n') == 'Noa (Oct 8 12:00): moved', there.stdout



def same(got, want):
    """Equal text. On Windows, Python ignores the TZ the test sets, so times come out in the machine's own
    zone (what a real user wants): there everything but the clock is compared."""
    if not sys.platform.startswith('win'):
        return got == want
    clock = re.compile(r'\((?:[A-Z][a-z]{2} \d{1,2} )?\d{2}:\d{2}\)|, \d{2}:\d{2}\]')
    return clock.sub('(T)', got) == clock.sub('(T)', want)

def main():
    home = tempfile.mkdtemp()
    project = os.path.join(home, '.claude', 'projects', '-p')
    os.makedirs(project)
    with open(os.path.join(project, 'sess-1.jsonl'), 'w', encoding='utf-8') as handle:
        for row in ROWS:
            handle.write(json.dumps(row, ensure_ascii=False) + '\n')

    # No account file: "Me".
    receipt, body = run(home, 'sess-1', '/p', '--print')
    assert receipt == {'ok': True, 'mine': 3, 'claude': 3, 'compacts': 1}, receipt
    assert same(body, expected('Me')), f'\n--- got ---\n{body}\n--- expected ---\n{expected("Me")}'

    # The first word of the account's name.
    with open(os.path.join(home, '.claude.json'), 'w', encoding='utf-8') as handle:
        json.dump({'oauthAccount': {'displayName': 'Dana Levi', 'emailAddress': 'x@example.com'}}, handle)
    _, body = run(home, 'sess-1', '/p', '--print')
    assert same(body, expected('Dana')), body

    # --latest: the newest conversation of the folder.
    time.sleep(0.05)
    with open(os.path.join(project, 'sess-2.jsonl'), 'w', encoding='utf-8') as handle:
        handle.write(json.dumps({'type': 'user', 'timestamp': '2026-10-08T09:00:00Z', 'message': {'content': 'newest'}}) + '\n')
    receipt, body = run(home, '--latest', '/p', '--print')
    assert receipt == {'ok': True, 'mine': 1, 'claude': 0, 'compacts': 0}, receipt
    assert same(body, 'Dana (Oct 8 12:00): newest'), body

    receipt, body = run(home, '${CLAUDE_SESSION_ID}', '/p', '--print')
    assert same(body, 'Dana (Oct 8 12:00): newest'), body

    copy_checks(home)

    receipt, _ = run(home, 'nope', '/p', '--print')
    assert receipt == {'ok': False, 'why': 'the conversation file was not found'}, receipt
    receipt, _ = run(home, '--latest', '/elsewhere', '--print')
    assert receipt == {'ok': False, 'why': 'the conversation file was not found'}, receipt
    print('thread.py: 10 checks pass')


main()
