# Context Mods

Jay's Claude Code mods for long conversations: read the part that matters, and keep it when you compact. Page: https://jaygptpro.com/context-mods/

[עברית](README.he.md)

Small add-ons that change how Claude Code looks and works: a button above the prompt, and a
yellow highlight on the part of a long reply worth reading. Each one is a Claude Code mod (a
plugin with function hooks) packed inside a skill folder, so one command installs it and Claude
Code loads it by itself in every new conversation.

| Mod | What you get | Costs |
| --- | --- | --- |
| **TL;DR** (`tldr-highlight`) | After a long reply, the paragraphs worth reading turn yellow and a notification says the reply in one sentence, in your language. A `TL;DR` button turns it on and off. | One short Haiku call per long reply, from your Claude plan |
| **Smart PreCompact** | A context meter above the prompt and a `Smart compact` button that tells the compact what to keep. Lives in its own repo: [JayGPTPro/smart-precompact](https://github.com/JayGPTPro/smart-precompact). | One call when you compact |

Installed together, they can share one row above the prompt in the desktop app.

## Install

### The easy way: Claude installs it

Open Claude Code and paste the prompt for what you want. Claude runs the install, checks it, and
tells you what to expect.

- Both (TL;DR and Smart PreCompact): [install-prompts/all.txt](install-prompts/all.txt)
- TL;DR alone: [install-prompts/tldr.txt](install-prompts/tldr.txt)

Then open a new conversation. Mods load only when a conversation starts.

### By hand

You need Node.js (for `npx`):

```bash
npx skills add JayGPTPro/context-mods --skill tldr-highlight -g -a claude-code
```

Smart PreCompact installs from its own repo:

```bash
npx skills add JayGPTPro/smart-precompact -g -a claude-code
```

Without Node.js: download the repo as a zip and copy `skills/tldr-highlight` into
`~/.claude/skills/` (Windows: `%USERPROFILE%\.claude\skills\`). Keep the hidden `.claude-plugin`
folder inside it.

## What TL;DR does

When a reply runs past about 150 words, a small model reads it and picks at most three
paragraphs: the direct answer, anything waiting on you, and anything that failed or was not
checked. They get a yellow background: past the first one, no more than a third of the reply,
and never code or a lone heading.
The same call writes the reply as one sentence in the language you write in, shown as a
notification. `↩ No TL;DR` turns it off and the choice is kept; `TL;DR` turns it back on.
The highlight is drawn in the desktop app. A terminal shows the button and the sentence.

Only the drawing changes. The conversation, and what Claude reads, stay as written. The call to
the model goes through your own Claude Code login, like the conversation itself.

## Turning it off, or removing it

```bash
claude plugin disable tldr@skills-dir
```

To remove it:

```bash
npx skills remove tldr-highlight -g
```

Never keep a backup copy of a mod's folder inside `~/.claude/skills`: Claude Code would load it
twice.

## When something does not show

- **No button in a new conversation:** your Claude Code version does not run mods yet. Update
  Claude Code.
- **Two rows above the prompt instead of one:** TL;DR draws into Smart PreCompact's row when it
  loads after it. Claude Code loads skill folders in the order your disk lists them, so on some
  machines Smart PreCompact comes first and keeps its own row. Everything works the same.
- **A narrow window** keeps Smart PreCompact's row whole and puts TL;DR in a row of its own.
- **In a terminal** Smart PreCompact always keeps its own row, and TL;DR gets a second one.
- `claude --debug` writes the engine's notes about each mod to the debug log, on lines that start
  with the mod's name.

## For developers

The mod is a skill folder in `skills/`: `SKILL.md`, `.claude-plugin/plugin.json`, `hooks/`
(`register.tsx`, and `panel.ts`, the shared row) and `tests/`. `dev/test-all.sh` runs every
check: the mod's `claude plugin test` and `claude plugin validate`, and the shared row in every
order the mod and Smart PreCompact can load in. It runs on Mac and Linux.

Built by [Jay](https://jaygptpro.com). An independent project, not an Anthropic product.
