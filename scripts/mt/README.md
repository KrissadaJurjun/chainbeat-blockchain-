# Machine-assisted translation pipeline

This folder is how 51 of the 60 locales were first produced. It is kept in the repository so the process is
reproducible and so nobody has to guess what "translated" means here. **It is not part of the app or of
`npm run verify`**, it needs Python and (practically) a CUDA GPU, and **its output has not been reviewed by native
speakers** — see [docs/I18N.md](../../docs/I18N.md).

## What is machine and what is hand-written

| Part | Who/what wrote it |
| --- | --- |
| English source (`src/i18n/locales/en`) | the project |
| `glossary/<code>.txt` — 130 core UI terms per language (Dashboard, Validators, Send, Cancel, Amount, Yes/No/Abstain …) | hand-written by the AI assistant that built the project, one line per entry of `glossary-terms.txt`; **not by native speakers** |
| Everything else in those 51 locales (roughly 850 of the 990 entries: every sentence, and every shorter label that is not in the glossary) | [NLLB-200 distilled 600M](https://huggingface.co/facebook/nllb-200-distilled-600M) (Meta), run locally, with the safeguards below |
| `th`, `ar`, `es`, `zh-CN`, `ja`, `ko`, `fr`, `de` | written by the AI assistant directly (first ~640 strings) plus NLLB for the strings added later; Thai's later additions were again written directly |

The model weights are licensed **CC-BY-NC 4.0 (non-commercial)**. Check that licence before using generated text in a
commercial product — and have a professional translator re-do the strings anyway.

## Safeguards around the model

`tlib.py` / `run.py` do the following, because a raw 600M model is not trustworthy on UI strings:

- `{{placeholders}}` and product/token names (`CHAINBEAT`, `ATOM`, `Demo` …) are replaced with number sentinels before
  translation and put back afterwards; every sentinel must come back the same number of times or the string is
  re-translated sentence-piece by sentence-piece (`segmented` in the run output).
- Plural families (`key_one` / `key_other`) are generated for each CLDR category the language needs, by translating the
  English text with a sample number of that category (`plural-samples.mjs`) and turning that number back into
  `{{count}}`.
- The hand-written glossary overrides the model for every catalog string that equals a glossary term.
- Output hygiene: terminal punctuation follows the English source, output must contain the target script, repetition
  loops are retried with stricter decoding, Thai/Lao composed vowels are normalised.
- A crude **round-trip check** (translate back to English, compare word overlap) flags low-agreement strings
  (`weak` in the run output; between roughly 15 % and 55 % of strings per language). It is a smoke alarm, not a
  quality score, and flagged strings were **not** individually reviewed.

## Reproducing a run

```bash
pip install torch transformers sentencepiece            # a CUDA build of torch is strongly recommended
node scripts/export-locale.mjs en > scripts/mt/en-flat.txt
node scripts/mt/plural-samples.mjs > scripts/mt/plural-samples.json
python scripts/mt/run.py --langs th,ru                  # or --langs all;  --only keys.txt  limits it to those keys
python scripts/mt/merge.py ru                           # base run + glossary + delta run → final/ru.txt
node scripts/build-locale.mjs ru scripts/mt/final/ru.txt
npm run i18n:check
```

`out/`, `out-delta/`, `final/`, `en-flat.txt` and `plural-samples.json` are working files (git-ignored).
