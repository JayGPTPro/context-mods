---
name: hebrew-tools
description: |
  About the Hebrew tools mod that comes with this skill: buttons above the prompt that
  translate the last English reply into Hebrew and back, and flip Hebrew lines between right
  and left alignment. Use when the user asks what these buttons are, how translation works or
  what it costs, why Hebrew is aligned a certain way, how to turn it off, or how to remove it.
  Triggers: "Translate to Hebrew button", "Hebrew tools", "⇄ Left button", "כפתור תרגום",
  "יישור לימין", "העברית לא מיושרת", "המוד של העברית".
  NOT for translating a text the user gives you in the chat: just translate it.
---

# Hebrew tools

This folder holds a Claude Code mod (the `.claude-plugin` and `hooks` folders). Claude Code
loads it by itself in every new conversation. This skill only answers questions about it.
Answer in the language of the user's messages.

## The buttons

- `Translate to Hebrew` shows when one of the last few replies has English text. It translates
  every English text block of that reply and draws the Hebrew in their place. Code, commands,
  paths, names and numbers stay as written.
- `↩ Original` and `Show Hebrew` switch every translation back and forth.
- `⇄ Left` and `⇄ Right` flip the side Hebrew lines align to. Right is the default. Lines that
  open in English but are mostly Hebrew align right too. The choice is kept for the next
  conversations.
- Only the drawing changes. The conversation, and what Claude reads, stay as written.

When other mods from this collection, or Smart PreCompact, are installed, the buttons sit in
the same row as theirs.

## What it costs

Aligning costs nothing. Each press of `Translate to Hebrew` sends that reply to Sonnet once,
from the user's own Claude plan. A translation is kept for the conversation, so switching back
and forth costs nothing more.

## Turning it off, or removing it

- Off without removing: `claude plugin disable hebrew-tools@skills-dir`
- Remove: `npx skills remove hebrew-tools -g`, or delete `~/.claude/skills/hebrew-tools`
- No buttons in a new conversation: this Claude Code version does not run mods yet.
