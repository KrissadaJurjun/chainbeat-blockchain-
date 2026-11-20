#!/usr/bin/env python
"""
Run the machine-assisted translation of the English catalog (see tlib.py for the pieces around the model).

  python run.py --langs th,ru            # translate those locales into out/<code>.txt (+ .report.json)
  python run.py --langs all
  python run.py --langs th --only keys.txt   # merge mode: just the keys listed (and their plural families)

Hand-written overrides: glossary-terms.txt (English, one per line) is aligned with glossary/<code>.txt (the same
number of lines, one translation each; an empty line means "no override"). An override replaces the model for every
catalog string equal to that English text.
"""
import argparse, json, os, re, sys, time, unicodedata
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from tlib import *  # noqa: F401,F403
from tlib import MODEL, NLLB, Unit, edge_fix, wrong_script, degenerate, f1, read_flat, HERE, PH

BATCH = 32


def tidy(lang, s):
    s = unicodedata.normalize("NFC", s)
    if lang == "th":
        s = s.replace("ํา", "ำ")  # NLLB emits SARA AM as NIKHAHIT + SARA AA
    if lang == "lo":
        s = s.replace("ໍາ", "ຳ")
    s = re.sub(r"[ \t]+", " ", s).strip()
    if lang != "fr":  # the sentinel swap can leave a gap before punctuation
        s = re.sub(r"\s+([.,;:!?])(?=\s|$)", r"\1", s)
    return s


class Engine:
    def __init__(self):
        t0 = time.time()
        self.tok = AutoTokenizer.from_pretrained(MODEL, src_lang="eng_Latn")
        self.model = AutoModelForSeq2SeqLM.from_pretrained(MODEL, dtype=torch.float16).cuda().eval()
        print(f"model ready in {time.time() - t0:.0f}s", flush=True)

    @torch.inference_mode()
    def run(self, texts, src, tgt, beams=3, **gen):
        self.tok.src_lang = "eng_Latn" if src == "en" else NLLB[src]
        bos = self.tok.convert_tokens_to_ids("eng_Latn" if tgt == "en" else NLLB[tgt])
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        result = [""] * len(texts)
        for s in range(0, len(order), BATCH):
            idx = order[s:s + BATCH]
            enc = self.tok([texts[i] for i in idx], return_tensors="pt", padding=True, truncation=True, max_length=160).to("cuda")
            out = self.model.generate(**enc, forced_bos_token_id=bos, num_beams=beams, max_new_tokens=int(enc["input_ids"].shape[1] * 2) + 8, **gen)
            for i, d in zip(idx, self.tok.batch_decode(out, skip_special_tokens=True)):
                result[i] = d.strip()
        return result


def load_glossary(lang):
    terms = [l.rstrip("\n") for l in open(os.path.join(HERE, "glossary-terms.txt"), encoding="utf8")] if os.path.exists(os.path.join(HERE, "glossary-terms.txt")) else []
    path = os.path.join(HERE, "glossary", f"{lang}.txt")
    if not terms or not os.path.exists(path):
        return {}
    vals = [l.rstrip("\n") for l in open(path, encoding="utf8")]
    if len(vals) != len(terms):
        sys.exit(f"glossary/{lang}.txt has {len(vals)} lines but glossary-terms.txt has {len(terms)}")
    return {t: tidy(lang, v) for t, v in zip(terms, vals) if v.strip()}


def build_units(en, lang, samples):
    families, seen, units = {}, set(), []
    plural = re.compile(r"(.+)_(zero|one|two|few|many|other)$")
    for k, v in en.items():
        m = plural.match(k)
        if m:
            families.setdefault(m.group(1), {})[m.group(2)] = v
    cats = samples[lang]
    for k, v in en.items():
        m = plural.match(k)
        if not m:
            units.append(Unit(k, v))
        elif m.group(1) not in seen:
            seen.add(m.group(1))
            fam = families[m.group(1)]
            for cat, sample in cats.items():
                if sample is not None:
                    source = fam["one"] if cat == "one" and "one" in fam else fam.get("other", fam.get("one"))
                    units.append(Unit(f"{m.group(1)}_{cat}", source, sample))
    return units, cats


def by_segments(eng, unit, lang):
    """Last resort when a placeholder did not survive: translate the text between placeholders, keep them in order."""
    parts = re.split(r"(\{\{[^}]*\}\})", unit.src)
    texts = [p for p in parts if p.strip() and not PH.fullmatch(p)]
    done = dict(zip(texts, eng.run(texts, "en", lang, beams=3))) if texts else {}
    return " ".join(p if PH.fullmatch(p) else done.get(p, p) for p in parts if p.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", required=True)
    ap.add_argument("--en", default=os.path.join(HERE, "en-flat.txt"))
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--only")
    ap.add_argument("--threshold", type=float, default=0.3)
    a = ap.parse_args()
    en = read_flat(a.en)
    samples = json.load(open(os.path.join(HERE, "plural-samples.json")))
    langs = [c for c in NLLB if c != "en"] if a.langs == "all" else a.langs.split(",")
    plural_suffix = re.compile(r"_(zero|one|two|few|many|other)$")

    def read_only(lang):
        if not a.only:
            return None
        path = os.path.join(a.only, f"{lang}.txt") if os.path.isdir(a.only) else a.only
        return {plural_suffix.sub("", k) for k in open(path, encoding="utf8").read().split()}
    os.makedirs(a.out, exist_ok=True)
    eng = Engine()
    for lang in langs:
        t0 = time.time()
        units, cats = build_units(en, lang, samples)
        only = read_only(lang)
        if only is not None:
            units = [u for u in units if plural_suffix.sub("", u.key) in only]
        gl = load_glossary(lang)
        todo = [u for u in units if u.src not in gl]
        texts = list(dict.fromkeys(u.text for u in todo))
        best = dict(zip(texts, eng.run(texts, "en", lang, beams=3)))
        probe = {u.text: u for u in todo}

        def bad(t):
            s = best[t]
            return not s or degenerate(s) or wrong_script(lang, s) or probe[t].restore(s) is None

        redo = [t for t in texts if bad(t)]
        if redo:
            for t, s in zip(redo, eng.run(redo, "en", lang, beams=5, no_repeat_ngram_size=3, repetition_penalty=1.2)):
                if not bad_after(t, s, probe, lang) or bad(t):
                    best[t] = s
        order = list(best)
        back = dict(zip(order, eng.run([best[t] for t in order], lang, "en", beams=1)))
        score = {t: f1(t, back[t]) for t in order}
        out, report = {}, {"language": lang, "model": MODEL, "weak": [], "segmented": [], "glossary": 0}
        for u in units:
            if u.src in gl:
                out[u.key] = gl[u.src]
                report["glossary"] += 1
                continue
            raw = tidy(lang, best[u.text])
            fixed = u.restore(raw) if raw else None
            if fixed is None or not fixed:
                fixed = tidy(lang, by_segments(eng, u, lang))
                report["segmented"].append(u.key)
            out[u.key] = tidy(lang, edge_fix(u.src, fixed, lang))
            if score[u.text] < a.threshold:
                report["weak"].append({"key": u.key, "english": u.src, "text": out[u.key], "roundtrip": round(score[u.text], 2)})
        bases = {re.sub(r"_(zero|one|two|few|many|other)$", "", k) for k in out if re.search(r"_(zero|one|two|few|many|other)$", k)}
        for base in bases:  # categories no whole number falls into (ru "other", cs "many" …) reuse the nearest generated form
            for cat, sample in cats.items():
                if sample is None:
                    for alt in ("other", "many", "few", "one"):
                        if f"{base}_{alt}" in out and cats.get(alt) is not None:
                            out[f"{base}_{cat}"] = out[f"{base}_{alt}"]
                            break
        with open(os.path.join(a.out, f"{lang}.txt"), "w", encoding="utf8", newline="\n") as f:
            f.writelines(f"{k}={v}\n" for k, v in out.items())
        json.dump(report, open(os.path.join(a.out, f"{lang}.report.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
        print(f"{lang}: {len(out)} entries · glossary {report['glossary']} · weak {len(report['weak'])} · segmented {len(report['segmented'])} · {time.time() - t0:.0f}s", flush=True)


def bad_after(t, s, probe, lang):
    return not s or degenerate(s) or wrong_script(lang, s) or probe[t].restore(s) is None


if __name__ == "__main__":
    main()
