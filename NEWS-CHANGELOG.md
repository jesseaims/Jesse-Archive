# News panel and changelog

The **News** button appears to the right of **Protetto localmente** in the unlocked application's header.

- **Novità**: curated Italian release notes kept in `src/news-changelog.ts`.
- **Commit**: real Git commit hashes and subject lines from the local repository, generated at build time by `scripts/generate-commits.mjs` into `src/commits.generated.json`.
- Everything is packaged in the frontend; **friends can read both tabs offline** and no vault data is accessed.
- If Git is not available or the extracted folder has no `.git`, the build uses the last checked-in JSON snapshot.
- The 23 historical commits were reconstructed from source archives; their timestamps are reconstruction timestamps, not original development dates. The panel makes this clear.
- Each news item stores a fixed ISO 8601 `addedAt` value. Existing entries were backfilled from their first appearance in Git (`dateSource: 'git'`); hovering over the individual timestamp explains that provenance. These are insertion records, not inferred original feature-development times.
- Each commit snapshot stores the full Git committer timestamp (`%cI`). Both tabs show date and time at the bottom right of every entry, in the user's local timezone, at 12px. Missing legacy commit times are explicitly shown as unavailable, never replaced by the build time.

## Publishing future changes

1. Update `src/news-changelog.ts` with one short user-facing entry for a meaningful release or feature and a fixed `addedAt` ISO timestamp with timezone. Do not compute insertion dates during rendering or builds.
2. Commit changes with Git before building the installer. The `npm run build` prebuild step refreshes the commit list from Git automatically. If building before committing, the uncommitted work will not appear in the Commit tab.
3. Build the normal Inno Setup EXE installer (`Build-Setup-EXE.ps1`).

No backend, encryption or vault schema changes were made for this feature.
