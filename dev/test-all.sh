#!/bin/sh
# Every check this collection has, in one run: the mod's own tests, and the mod loaded together with
# Smart PreCompact's row in every order.
set -e
cd "$(dirname "$0")/.."
claude plugin validate skills/tldr-highlight > /dev/null
claude plugin test skills/tldr-highlight
# A test may import only from inside its own plugin folder: the shared row file is copied in.
cp skills/tldr-highlight/hooks/panel.ts dev/together/hooks/panel.ts
claude plugin test dev/together
rm -f dev/together/hooks/panel.ts
echo 'All checks pass'
