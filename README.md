# Harf Sprint

A 60-second Arabic reading sprint for the whole family.
Letters, words and sentences are all read aloud and checked by speech recognition.
Without a microphone a sprint becomes unranked practice: letters pick the name from four buttons, words and sentences self-report.
Players and scores are stored only in the browser (localStorage).

## Develop

```bash
pnpm install
pnpm dev
```

## Quality gates

```bash
pnpm lint
pnpm check
pnpm test:unit --run
pnpm test:e2e
```

## Build

`pnpm build` writes the static site to `build/`.
