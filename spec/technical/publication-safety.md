# Publication Safety Technical Spec

## Acceptance Criteria

- No `.env` or `.env.*` files are tracked, except `.env.example` and
  `.env.release.example`.
- No IDE workspace files are tracked.
- Public configuration examples contain placeholders only.
- Services bind with an explicit host and default to `127.0.0.1`.
- The repository has a machine-checkable publication gate.
- Public GitHub releases are made from a clean snapshot, not from private Git
  history.

## Verification

- Run `npm run check:public`.
- Run `npm test`.
- Run `npm run release:public:prepare -- --out /tmp/bots-public --force`.
- Run `git ls-files` and confirm sensitive local files are absent.

## Known Historical Risk

Secrets that were previously committed remain in Git history until history is rewritten or the repository is recreated. Removing files from the latest tree is necessary but not sufficient for public release.
