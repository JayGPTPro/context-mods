"""The shared row file (hooks/panel.ts) must be the same in every mod. Run: python3 dev/check_shared.py"""
import hashlib
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'skills')
MODS = ['tldr-highlight', 'copy-chat']

digests = {}
for mod in MODS:
    with open(os.path.join(ROOT, mod, 'hooks', 'panel.ts'), 'rb') as handle:
        digests[mod] = hashlib.sha256(handle.read()).hexdigest()[:12]
if len(set(digests.values())) != 1:
    print('panel.ts differs between mods:', digests)
    sys.exit(1)
print('panel.ts: the same in both mods')
