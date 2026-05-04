# Public GitHub Release Procedure

This repo stays private in Bitbucket. Public GitHub releases are published from
a clean snapshot so private Git history is never pushed.

## Prepare Snapshot

```bash
npm run release:public:prepare -- \
  --out /tmp/bots-public \
  --version 1.0.0 \
  --github-repo 0x730/dex-bot-services \
  --secrets-rotated \
  --force
```

## One-Command Publish

Copy [.env.release.example](.env.release.example) to `.env.release.local`, fill
in the real values, rotate historical secrets, and set
`RELEASE_SECRETS_ROTATED=true`.

Then run:

```bash
npm run release:public:publish
```

The one-command publisher uses `GITHUB_PAT` directly. It creates the GitHub
repository and release through the GitHub REST API, then pushes the generated
snapshot with plain `git`.

By default, `RELEASE_VERSION=auto` queries GitHub releases/tags and publishes the
next patch version. For example, latest `v1.2.3` becomes `v1.2.4`; a repository
with no releases starts at `v0.0.1`. Set `RELEASE_VERSION=1.3.0` to override.

If GitHub already has a `main` commit and this repo is intended to be a generated
snapshot mirror, set `RELEASE_REPLACE_MAIN=true`. The publisher then uses
`git fetch` followed by `git push --force-with-lease` for `main`. Do not use this
for a public repo where remote-only commits should be preserved.

For a no-push preview:

```bash
npm run release:public:publish -- --dry-run
```

The command runs `npm test` and `npm run check:public`, copies only public-safe
files, initializes a new Git repo in the export directory, and prints the exact
GitHub commands to run next.

The public snapshot intentionally excludes private planning files, old archives,
local logs, live smoke scripts, and stale local tool configs.

The command blocks before export when required public metadata is missing:
`LICENSE`, public package/repository name, description, and matching package
license.

Use `--dry-run` to run release checks without creating a snapshot:

```bash
npm run release:public:prepare -- --dry-run
```

## Publish

```bash
cd /tmp/bots-public
git add .
git commit -m "Release 1.0.0"
git remote add origin https://github.com/0x730/dex-bot-services.git
git push -u origin main
# If RELEASE_REPLACE_MAIN=true, the publisher uses:
# git fetch --depth=1 origin main:refs/remotes/origin/main
# git push -u origin main --force-with-lease
git tag v1.0.0
git push origin v1.0.0
```

## Required Manual Checks

- Rotate every secret that was ever committed in the private repository.
- Confirm `.env.example` contains placeholders only.
- Choose the correct public license and copyright holder before release.
- Choose the public package/repository name and description.
- Review `README.md`, docs, and `spec/` for private business context.
- Smoke-test production-used services before tagging.
