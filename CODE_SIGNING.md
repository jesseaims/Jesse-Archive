# Code signing policy

> **In breve (italiano).** Il progetto ha chiesto la firma gratuita del setup Windows a SignPath Foundation. Finché la richiesta non è approvata, il setup **non è firmato** con Authenticode e Windows SmartScreen può mostrare un avviso. Quando sarà attiva, verranno firmati solo i setup compilati da GitHub Actions dal codice pubblico di questo repository, e ogni firma sarà approvata a mano dal maintainer.

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

**Status:** application to the SignPath Foundation open source program in progress. Until it is approved, Windows releases are **not** Authenticode-signed. This page will be updated when signing starts.

## What is signed

- `JesseArchive-Setup.exe`, the Windows installer published in the [GitHub releases](https://github.com/jesseaims/Jesse-Archive/releases) of this repository.
- Possibly the programs it installs (`jesse_archive.exe`, `jesse-browser-host.exe`), if they are signed in the same request.

Nothing else is signed with this certificate: no third-party software and no builds made outside this repository. The browser extension is distributed through the Chrome Web Store and addons.mozilla.org, which sign it themselves.

## How a release is built and signed

1. Every change reaches `main` through a pull request whose continuous integration checks (`.github/workflows/ci.yml`) must pass.
2. The setup is built by GitHub Actions on GitHub-hosted runners from the public source of this repository (`.github/workflows/release-build.yml`). Builds made on a personal computer are never signed.
3. The workflow submits the setup to SignPath. **Every signing request is approved manually** by the approver listed below.
4. The signed setup is published as a GitHub release. Independently of Authenticode, the app's automatic updater accepts only installers whose manifest is signed with the project's Ed25519 update key (see [docs/SECURITY.md](docs/SECURITY.md)).

## Team roles

The project currently has a single maintainer, who holds all roles:

| Role | Member |
|---|---|
| Committer and reviewer | [jesseaims](https://github.com/jesseaims) |
| Approver | [jesseaims](https://github.com/jesseaims) |

All members use multi-factor authentication on GitHub and SignPath.

## Privacy

The desktop app keeps all data in a local encrypted vault and has no account or cloud service of its own. It connects to the Internet only for update checks (which can be turned off), breached-password checks started by the user (k-anonymity: only the first 5 characters of the SHA-1 hash leave the device) and optional site icons. The browser extension sends data only to the app on the same computer. Details: [privacy policy](https://jessearchive.it/privacy/) and [extension privacy policy](https://jessearchive.it/en/extension-privacy/).

## Reporting a problem

Questions about this policy or a suspected misuse of the signature: [support](https://jessearchive.it/supporto/) or a [GitHub issue](https://github.com/jesseaims/Jesse-Archive/issues).
