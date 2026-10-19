# Context Mods

Jay's Claude Code mods for long conversations: read the part that matters, keep it when you compact, and move it cleanly to another chat. Page: https://jaygptpro.com/context-mods/

[עברית](README.he.md)

Small add-ons that change how Claude Code looks and works: buttons above the prompt, a yellow
highlight on the part of a long reply worth reading, a clean copy of the whole chat. Each one is
a Claude Code mod (a plugin with function hooks) packed inside a skill folder, so one command
installs it and Claude Code loads it by itself in every new conversation.

| Mod | What you get | Costs |
| --- | --- | --- |
| **TL;DR** (`tldr-highlight`) | After a long reply, the paragraphs worth reading turn yellow and a notification says the reply in one sentence, in your language. A `TL;DR` button turns it on and off. | One short Haiku call per long reply, from your Claude plan |
| **Copy chat** (`copy-chat`) | A `Copy chat` button: the whole conversation on your clipboard as clean text, `Name (12:01): ...`, ready to paste into another chat or a doc. | Nothing |
| **Smart PreCompact** | A context meter above the prompt and a `Smart compact` button that tells the compact what to keep. Lives in its own repo: [JayGPTPro/smart-precompact](https://github.com/JayGPTPro/smart-precompact). | One call when you compact |

Installed together, they share one row above the prompt in the desktop app.

## Install

### The easy way: Claude installs it

Open Claude Code and paste the prompt for what you want. Claude runs the install, checks it, and
tells you what to expect.

- Everything (TL;DR, Copy chat and Smart PreCompact): [install-prompts/all.txt](install-prompts/all.txt)
- One mod: [tldr.txt](install-prompts/tldr.txt) and [copy-chat.txt](install-prompts/copy-chat.txt)

Then open a new conversation. Mods load only when a conversation starts.

### By hand

You need Node.js (for `npx`). One mod, or several at once:

```bash
npx skills add JayGPTPro/context-mods --skill tldr-highlight -g -a claude-code
```

```bash
npx skills add JayGPTPro/context-mods --skill tldr-highlight copy-chat -g -a claude-code
```

Smart PreCompact installs from its own repo:

```bash
npx skills add JayGPTPro/smart-precompact -g -a claude-code
```

Without Node.js: download the repo as a zip and copy a folder from `skills/` into
`~/.claude/skills/` (Windows: `%USERPROFILE%\.claude\skills\`). Keep the hidden `.claude-plugin`
folder inside it.

## What each mod does

### TL;DR

When a reply runs past about 150 words, a small model reads it and picks at most three
paragraphs: the direct answer, anything waiting on you, and anything that failed or was not
checked. They get a yellow background: past the first one, no more than a third of the reply,
and never code or a lone heading.
The same call writes the reply as one sentence in the language you write in, shown as a
notification. `↩ No TL;DR` turns it off and the choice is kept; `TL;DR` turns it back on.
The highlight is drawn in the desktop app. A terminal shows the button and the sentence.

### Copy chat

One press copies the conversation: your messages and Claude's, with times, the date on the first
message and when the day changes, and a line where it was compacted. Tool calls, their output,
subagents and reminders are left out. Your name comes from your Claude account, else "Me". You
can also ask in words ("copy this chat"), which works even where mods do not.

It needs Python 3 for the times; without it the button copies the messages without times. On
Linux it uses `wl-copy`, `xclip` or `xsel` when one is there.

### Every mod

Only the drawing changes. The conversation, and what Claude reads, stay as written. Calls a mod
makes to a model go through your own Claude Code login, like the conversation itself.

## Turning one off, or removing it

```bash
claude plugin disable tldr@skills-dir
```

The names are `tldr` and `copy-chat`. To remove one:

```bash
npx skills remove tldr-highlight -g
```

Never keep a backup copy of a mod's folder inside `~/.claude/skills`: Claude Code would load it
twice.

## When something does not show

- **No buttons in a new conversation:** your Claude Code version does not run mods yet. Update
  Claude Code. Copy chat still works when you ask in words.
- **Two rows above the prompt instead of one:** the mods draw into Smart PreCompact's row when one
  of them loads after it. Claude Code loads skill folders in the order your disk lists them, so on
  some machines Smart PreCompact comes first and keeps its own row. Everything works the same.
- **A narrow window** keeps Smart PreCompact's row whole and puts the mods in a row of their own.
- **In a terminal** Smart PreCompact always keeps its own row, and the mods share a second one.
- `claude --debug` writes the engine's notes about each mod to the debug log, on lines that start
  with the mod's name.

## For developers

Each mod is a skill folder in `skills/`: `SKILL.md`, `.claude-plugin/plugin.json`, `hooks/`
(`register.tsx`, and `panel.ts`, the shared row, the same file in both) and `tests/`.
`dev/test-all.sh` runs every check: each mod's `claude plugin test`, `claude plugin validate`,
the Copy chat script's tests, that the two `panel.ts` copies match, and the shared row in every
order the mods and Smart PreCompact can load in. It runs on Mac and Linux.

Built by [Jay](https://jaygptpro.com). An independent project, not an Anthropic product.
