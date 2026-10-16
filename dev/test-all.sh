#!/bin/sh
# Every check this collection has, in one run: each mod's own tests, the transcript script's, the
# shared row file being the same in all three, and the three mods loaded together in every order.
set -e
cd "$(dirname "$0")/.."
python3 dev/check_shared.py
for mod in tldr-highlight copy-chat hebrew-tools; do
  claude plugin validate "skills/$mod" > /dev/null
  claude plugin test "skills/$mod"
done
python3 skills/copy-chat/tests/test_thread.py
# A test may import only from inside its own plugin folder: the shared row file is copied in.
cp skills/tldr-highlight/hooks/panel.ts dev/together/hooks/panel.ts
claude plugin test dev/together
rm -f dev/together/hooks/panel.ts
echo 'All checks pass'
