"""
tlib.py — the pieces around the NLLB model (see README.md in this folder):

  * Unit: one catalog string with its {{placeholders}} and product/token names swapped for number sentinels (digits
    survive translation), plural families expanded to the CLDR categories a language needs, restored and verified
  * edge_fix / wrong_script / degenerate / f1: output clean-up and quality checks (terminal punctuation follows the
    English source, output must be in the target script, no repetition loops, round-trip word overlap)
"""
import argparse, json, os, re, sys, time, unicodedata
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = "facebook/nllb-200-distilled-600M"
NLLB = {
    "th": "tha_Thai", "ja": "jpn_Jpan", "zh-CN": "zho_Hans", "zh-TW": "zho_Hant", "ko": "kor_Hang", "fr": "fra_Latn",
    "de": "deu_Latn", "es": "spa_Latn", "pt-BR": "por_Latn", "it": "ita_Latn", "nl": "nld_Latn", "sv": "swe_Latn",
    "nb": "nob_Latn", "da": "dan_Latn", "fi": "fin_Latn", "pl": "pol_Latn", "cs": "ces_Latn", "sk": "slk_Latn",
    "hu": "hun_Latn", "ro": "ron_Latn", "bg": "bul_Cyrl", "el": "ell_Grek", "tr": "tur_Latn", "ru": "rus_Cyrl",
    "uk": "ukr_Cyrl", "sr": "srp_Cyrl", "hr": "hrv_Latn", "bs": "bos_Latn", "sl": "slv_Latn", "sq": "als_Latn",
    "mk": "mkd_Cyrl", "et": "est_Latn", "lv": "lvs_Latn", "lt": "lit_Latn", "ar": "arb_Arab", "he": "heb_Hebr",
    "fa": "pes_Arab", "ur": "urd_Arab", "hi": "hin_Deva", "bn": "ben_Beng", "pa": "pan_Guru", "gu": "guj_Gujr",
    "mr": "mar_Deva", "ta": "tam_Taml", "te": "tel_Telu", "kn": "kan_Knda", "ml": "mal_Mlym", "ne": "npi_Deva",
    "si": "sin_Sinh", "my": "mya_Mymr", "km": "khm_Khmr", "lo": "lao_Laoo", "vi": "vie_Latn", "id": "ind_Latn",
    "ms": "zsm_Latn", "fil": "tgl_Latn", "sw": "swh_Latn", "am": "amh_Ethi", "ha": "hau_Latn",
}
# the script each language is written in (for the "output is really in the target language" check); None = Latin
SCRIPT = {
    "th": "THAI", "ja": "CJK", "zh-CN": "CJK", "zh-TW": "CJK", "ko": "HANGUL", "bg": "CYRILLIC", "el": "GREEK",
    "ru": "CYRILLIC", "uk": "CYRILLIC", "sr": "CYRILLIC", "mk": "CYRILLIC", "ar": "ARABIC", "he": "HEBREW",
    "fa": "ARABIC", "ur": "ARABIC", "hi": "DEVANAGARI", "bn": "BENGALI", "pa": "GURMUKHI", "gu": "GUJARATI",
    "mr": "DEVANAGARI", "ta": "TAMIL", "te": "TELUGU", "kn": "KANNADA", "ml": "MALAYALAM", "ne": "DEVANAGARI",
    "si": "SINHALA", "my": "MYANMAR", "km": "KHMER", "lo": "LAO", "am": "ETHIOPIC",
}
PROTECTED = ["CHAINBEAT", "Demo", "Cosmos Hub", "Osmosis", "Celestia", "Keplr", "Leap", "ATOM", "OSMO", "USDC", "BTC", "ETH", "TIA", "IBC"]
SENTINELS = [7391, 8264, 5927, 6418, 3159, 9742, 2683, 4876]
PH = re.compile(r"\{\{[^}]*\}\}")
SEP = r"[\s\u00a0\u202f.,'’]?"


def read_flat(path):
    out = {}
    for line in open(path, encoding="utf8").read().splitlines():
        if line.strip() and not line.startswith("#"):
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip()
    return out


def ascii_digits(s):
    return "".join(str(unicodedata.decimal(c)) if c.isdigit() and not c.isascii() and unicodedata.decimal(c, None) is not None else c for c in s)


def digit_re(n):
    return re.compile(r"(?<!\d)" + SEP.join(str(n)) + r"(?!\d)")


class Unit:
    __slots__ = ("key", "text", "mapping", "expect", "src", "kind", "glue")

    def __init__(self, key, english, sample=None):
        self.key = key
        self.src = english
        self.glue = [(m.group(1), m.group(2)) for m in re.finditer(r"(\{\{[^}]*\}\})(\d)", english)]  # "{{prefix}}1" must stay attached
        self.mapping = {}  # sentinel number -> original text
        self.expect = {}   # sentinel number -> occurrences in the source
        text = english
        used = list(SENTINELS)
        # plural: {{count}} becomes the category's sample number
        if sample is not None:
            for m in set(re.findall(r"\{\{\s*count\s*(?:,[^}]*)?\}\}", text)):
                self.mapping[sample] = m
                self.expect[sample] = text.count(m)
                text = text.replace(m, str(sample))
        for m in dict.fromkeys(PH.findall(text)):
            n = used.pop(0)
            self.mapping[n] = m
            self.expect[n] = text.count(m)
            text = text.replace(m, str(n))
        for term in PROTECTED:
            if re.search(r"\b" + re.escape(term) + r"\b", text):
                n = used.pop(0)
                self.mapping[n] = term
                self.expect[n] = len(re.findall(r"\b" + re.escape(term) + r"\b", text))
                text = re.sub(r"\b" + re.escape(term) + r"\b", str(n), text)
        self.text = text
        self.kind = "plural" if sample is not None else "plain"

    def restore(self, out):
        out = ascii_digits(out)
        for n, orig in self.mapping.items():
            rx = digit_re(n)
            found = len(rx.findall(out))
            if found != self.expect[n]:
                return None
            out = rx.sub(lambda _m, o=orig: o, out)
        if re.search(r"(?<!\d)(7391|8264|5927|6418|3159|9742|2683|4876)(?!\d)", out):
            return None
        for ph, d in self.glue:
            out = re.sub(re.escape(ph) + r"\s+" + d, ph + d, out)
        return out.strip()


def edge_fix(src, out, lang):
    """Make terminal punctuation follow the English source (UI labels must not grow full stops)."""
    ends = ".。．।॥።۔"
    if not src.rstrip().endswith((".", "…", "?", "!", ":")):
        out = out.rstrip(ends + " ")
    elif src.rstrip().endswith(".") and not out.rstrip().endswith(tuple(ends + "!?؟…")):
        out = out.rstrip() + {"ja": "。", "zh-CN": "。", "zh-TW": "。", "hi": "।", "bn": "।", "ne": "।", "am": "።"}.get(lang, "" if lang == "th" else ".")
    if src.rstrip().endswith(":") and not out.rstrip().endswith((":", "：")):
        out = out.rstrip() + ("：" if lang in ("ja", "zh-CN", "zh-TW") else ":")
    if src.isupper() and any(c.isalpha() for c in src):
        out = out.upper()
    return out


def wrong_script(lang, out):
    want = SCRIPT.get(lang)
    letters = [c for c in out if c.isalpha()]
    if not letters:
        return False
    if want is None:
        return sum(1 for c in letters if unicodedata.name(c, "").startswith("LATIN")) / len(letters) < 0.6
    hit = sum(1 for c in letters if want in unicodedata.name(c, "") or (want == "CJK" and ("CJK" in unicodedata.name(c, "") or "HIRAGANA" in unicodedata.name(c, "") or "KATAKANA" in unicodedata.name(c, ""))))
    return hit / len(letters) < 0.5


def degenerate(out):
    toks = out.split()
    if len(toks) >= 6 and len(set(toks)) / len(toks) < 0.45:
        return True
    return bool(re.search(r"(.{2,12})\1{3,}", out))


def words(s):
    s = PH.sub(" ", s.lower())
    return [w for w in re.findall(r"[a-z0-9]+", s) if w not in {"a", "an", "the", "of", "to", "is", "are", "in", "on", "for", "and"}]


def f1(a, b):
    A, B = words(a), words(b)
    if not A or not B:
        return 1.0
    common = 0
    pool = list(B)
    for w in A:
        if w in pool:
            pool.remove(w)
            common += 1
    if common == 0:
        return 0.0
    p, r = common / len(B), common / len(A)
    return 2 * p * r / (p + r)


