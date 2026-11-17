# Reconstructed Git history

This repository's commit history was **reconstructed** from actual archived source snapshots in the ChatGPT workspace. It is **not** an export of an earlier real Git history, and the commit timestamps/technical author do not represent original development times or authorship. Each historical commit records the differences present between consecutive available archives. Some commits necessarily group multiple changes because no finer-grained source snapshot is available.

The original Python source is retained in `legacy-python/` for audit and migration reference. The **original encrypted vault was never imported**. Do not commit actual credentials, personal vaults, or private keys.

The repository is local and has **no GitHub remote** configured. To publish after review, use `git remote add origin <url>` and `git push -u origin main`. GitHub authentication remains with the owner.

## Source snapshot → commit

| Commit | Message | Source archive |
|---|---|---|
| `388f0e4` | legacy: 🐍 Preserved original Python source | `JesseArchive v0.1.6.zip` |
| `bd48e63` | migration: 🦀 Ported vault manager to Rust and Tauri 2 | `JesseArchive-Tauri2-Sorgenti.zip` |
| `f9b9c93` | crypto: 🔐 Fixed Rust key handling and lifetimes | `JesseArchive-Tauri2-Corretto-v1.zip` |
| `3866935` | tests: 🧪 Fixed legacy encryption fixture path | `JesseArchive-Tauri2-Corretto-v2.zip` |
| `507863b` | recovery: 🛠️ Fixed recovery code confirmation | `JesseArchive-Tauri2-Corretto-v3.zip` |
| `3d56c4d` | vault: ✨ Improved branding, themes and account grouping | `JesseArchive-Tauri2-Corretto-v4.zip` |
| `f7f578b` | clipboard: ⚡ Removed PowerShell clipboard operations | `JesseArchive-Tauri2-Corretto-v5.zip` |
| `991524e` | clipboard: 🛠️ Corrected empty clipboard value type | `JesseArchive-Tauri2-Corretto-v5.1.zip` |
| `b29f1e6` | clipboard: 🛠️ Fixed clipboard write argument borrowing | `JesseArchive-Tauri2-Corretto-v5.2.zip` |
| `b06cc67` | dialogs: 🎨 Replaced native dialogs with themed modals | `JesseArchive-Tauri2-Corretto-v5.3.zip` |
| `889411b` | history: 🔑 Improved password restoration and added creator credit | `JesseArchive-Tauri2-Corretto-v5.4.zip` |
| `f3efd56` | cloud: ☁️ Improved local cloud folder discovery | `JesseArchive-Tauri2-Corretto-v5.5.zip` |
| `402c7af` | installer: 🎨 Added branded MSI graphics | `JesseArchive-Tauri2-MSI-Branding-v5.5.zip` |
| `eda3ac8` | installer: 📦 Bundled WebView2 for offline distribution | `JesseArchive-Distribuzione-Offline-v1.0.2.zip` |
| `2e882c4` | installer: 🪟 Added Inno Setup EXE packaging | `JesseArchive-Distribuzione-Offline-EXE-Inno-v1.0.2.zip` |
| `9d5854b` | editor: ✨ Preselected category for new entries | `JesseArchive-Distribuzione-Offline-v1.0.2-Categorie.zip` |
| `cfbd951` | installer: 📁 Added installation directory selection | `JesseArchive-Distribuzione-Offline-Cartella-Scelta-v1.0.2.zip` |
| `d5b9ce8` | installer: 🖼️ Corrected installer logo proportions | `JesseArchive-Distribuzione-Offline-Cartella-Scelta-v1.0.2-InstallerLogoFix.zip` |
| `74b43e8` | release: 🏷️ Displayed app version and simplified setup filename | `JesseArchive-Distribuzione-Offline-Versione-Setup.zip` |
| `351b244` | release: 🚧 Labeled application as Beta | `JesseArchive-Beta-1.0.2.zip` |
| `9c0be89` | generator: ✨ Enlarged password generation button | `JesseArchive-Beta-1.0.2-Genera-Grande.zip` |
| `270f083` | git: 🧹 Added repository configuration and safety rules | `JesseArchive-Beta-1.0.2-GitHub-Ready.zip` |
