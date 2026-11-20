#!/usr/bin/env python
"""
merge.py — final/<code>.txt for the locales that were machine-translated from scratch:

    base run (out/<code>.txt)  →  hand-written glossary applied to every exact match  →  overridden by the delta run

The delta run (out-delta/<code>.txt) re-translates only the keys that were added or changed after the base run
(`python run.py --langs … --only keys.txt --out out-delta`). Keys English no longer has are dropped, so
`node scripts/build-locale.mjs <code> final/<code>.txt` never sees an unknown key.

    python merge.py zh-TW,pt-BR,it
"""
import os, re, sys
from tlib import read_flat, HERE
from run import load_glossary

PLURAL = re.compile(r"_(zero|one|two|few|many|other)$")
en = read_flat(os.path.join(HERE, "en-flat.txt"))
valid = {PLURAL.sub("", k) for k in en}
keep = lambda d: {k: v for k, v in d.items() if PLURAL.sub("", k) in valid}

os.makedirs(os.path.join(HERE, "final"), exist_ok=True)
for lang in sys.argv[1].split(","):
    base = keep(read_flat(os.path.join(HERE, "out", f"{lang}.txt")))
    delta_path = os.path.join(HERE, "out-delta", f"{lang}.txt")
    delta = keep(read_flat(delta_path)) if os.path.exists(delta_path) else {}
    glossary = load_glossary(lang)
    replaced = 0
    for key in list(base):
        if not PLURAL.search(key) and key in en and en[key] in glossary:
            replaced += base[key] != glossary[en[key]]
            base[key] = glossary[en[key]]
    base.update(delta)
    with open(os.path.join(HERE, "final", f"{lang}.txt"), "w", encoding="utf8", newline="\n") as f:
        f.writelines(f"{k}={v}\n" for k, v in base.items())
    print(f"{lang}: {len(base)} entries (glossary replaced {replaced} model outputs, delta {len(delta)})")
