# Harf Sprint

A 60-second Arabic reading sprint for the whole family.
Letters mode is multiple choice; words and sentences with speech recognition arrive in Phase 2.
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
