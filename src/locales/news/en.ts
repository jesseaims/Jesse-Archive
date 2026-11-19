import type { NewsTranslations } from '../../news-changelog';

// English titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'installer-sharper-images': [
    'Sharper installer images',
    'The logo and the name on the side of the setup are now sharp: they come from the original artwork and are prepared at the exact size for every display scale, so Windows no longer has to stretch them.',
  ],
  'new-installer': [
    'New installer in the app’s style',
    'The setup has been redone: a single window from start to finish, with the dark theme and logo of Jesse’s Archive, instead of the procedure that went through Windows Installer. It now also has its own uninstaller, which removes the program without touching the vault and the settings. Updating from the previous version needs nothing from you: the new setup replaces the old one in the same folder.',
  ],
  'extension-logo-autoreload': [
    'Extension logo and automatic reload',
    'The browser extension now shows the Jesse’s Archive logo in the toolbar and in the extensions list. After every update it reloads by itself as soon as it connects to the app, with no need to do it by hand from the extensions page. Reload it by hand one last time: the automatic reload applies from the next updates.',
  ],
  'breach-check-autofill-fixes': [
    'More reliable breach check and autofill',
    'The compromised accounts check now also works with large vaults (before, it stopped with “Cannot reach Pwned Passwords” beyond about 120 passwords) and retries by itself if the network hiccups. Browser autofill also recognizes the login fields of sites built with web components, such as Reddit, and login frames from a subdomain of the same site, such as Ubisoft’s. After the update, reload the extension from the browser’s extensions page.',
  ],
  'global-quick-search': [
    'Global Quick Search',
    'Press Ctrl+Shift+Space from any application, even with Jesse’s Archive in the notification area, to open a compact search window: find accounts by name, username, email or site, with accounts of the same service grouped together, then copy the username or password, show the password for a few seconds, open the site or open the item in the vault, all from the keyboard. It only works while the vault is unlocked, passwords are copied without passing through the window and the clipboard is cleared as usual. Shortcut and options are in Settings → Global Quick Search.',
  ],
  'window-state': [
    'The window remembers its size and position',
    'Jesse’s Archive reopens the way you left it: full screen, maximized or with the size and position you chose, even after going through the tray. If the screen it was on is no longer connected, the window opens in the center of the available one.',
  ],
  'customizable-dashboard': [
    'Customizable dashboard',
    "The new Dashboard is the app's control center: security score, password audit, vault overview, favorites, recent items, secure notes, quick actions, generator, backup status and privacy. With “Customize dashboard” you add, remove, drag and resize widgets, choose between several layouts and adjust each widget's options; everything is saved automatically in the encrypted vault and no widget shows passwords.",
  ],
  multilanguage: [
    'Jesse’s Archive speaks your language',
    'With the new “Language” button at the top right you can choose Italian, English, Spanish, French, German, Portuguese, Russian, Chinese, Japanese or Korean. The whole app switches at once, including the unlock screen, the browser mini window and the notification area menu; on first start the Windows language is used. The installer and the browser extension also follow the system language.',
  ],
  'installer-logo': [
    'Installer logo fixed',
    'During installation the logo at the top right no longer looks squashed: it is now the app logo, sharp and correctly proportioned even with a zoomed display.',
  ],
  'webauthn-passkeys': [
    'Passkeys on websites',
    'When a site offers a passkey, Jesse’s Archive opens the mini window: you can save it in the encrypted vault and use it to sign in, or choose “Use another device” for your phone or Windows Hello. Every use needs your confirmation. Reload the extension in the browser after updating; Firefox needs version 128 or later. You can turn it off in Settings → Desktop.',
  ],
  'auto-update': [
    'Automatic updates',
    'The app checks for new versions at startup and once a day and asks whether to install them: “Update now” downloads the installer, verifies the author’s digital signature and reopens the app updated. In Settings → Updates you can check manually or turn off the automatic check.',
  ],
  'zoom-typed-min-max': [
    'Custom zoom, minimum and maximum',
    'In Settings → Appearance you can type the zoom percentage you prefer (from 50 to 200) and use the two new buttons to jump straight to the minimum or maximum zoom.',
  ],
  'interface-zoom': [
    'Interface zoom',
    'Zoom the app in or out with Ctrl + + and Ctrl + − (or Ctrl + F12 / Ctrl + F11 or Ctrl + mouse wheel) and go back to 100% with Ctrl + 0. You also find it in Settings → Appearance: it applies to every window and is remembered on this PC.',
  ],
  'empty-trash': [
    'Empty trash',
    'On the Trash page, the “Empty trash” button permanently deletes all items at once, after two confirmations that show what will be deleted.',
  ],
  'settings-layout-installer-flow': [
    'More compact settings and easier installation',
    'The Settings panels now fit together without gaps. The installer offers a checkbox to start the app at the end, and the extensions guide has an “I installed the extension” button that closes it and opens Jesse’s Archive.',
  ],
  'refresh-feedback-appearance': [
    'Refresh button with results and a new Appearance tab',
    'The Refresh button tells you what it did: whether it found new, changed or removed items, or that everything was already up to date, and if something goes wrong it explains why. App themes and colors now have their own Appearance tab in Settings.',
  ],
  'regroup-on-site-change': [
    "An account's site updates when you change it",
    "If you change an account's website, it immediately appears under the new site in your collection instead of staying under the one entered at first. Entries saved earlier are fixed automatically too.",
  ],
  'delete-accounts-and-groups': [
    'Deleting accounts, groups and items',
    'Each account group has a “Delete account” button for a single account and a trash icon to delete the whole group, with a double confirmation listing what will be deleted. Items in the other categories can also be deleted with one click and a confirmation. Everything goes to the Trash, where it can be restored.',
  ],
  'session-hardening': [
    'More reliable auto-lock and safer imports',
    'The vault really locks after the chosen inactivity time, even with the window hidden, and the screen is cleared. Keyboard, clicks and scrolling count as activity. An import file with even a single invalid item is rejected without changing the vault, and the minimum password length now counts accented letters correctly.',
  ],
  'news-entry-timestamps': [
    'Date and time for every news item and commit',
    'Every entry in the News and Commits tabs shows its own date and time at the bottom right, in readable text. Times stay the same from one build to the next.',
  ],
  'browser-site-matching': [
    'Accounts recognized across domain and subdomains',
    'Addresses saved without a protocol are recognized, and accounts are also suggested on the sign-in pages of subdomains of the same site, such as the Epic Games Store. The comparison tells apart unrelated domains and services with independent subdomains.',
  ],
  'browser-extension-navigation': [
    'Extensions page opens correctly',
    'The guide opens a new window of the chosen browser and reaches its extensions page from the address bar. A copyable address and a retry button were added.',
  ],
  'browser-setup-wizard': [
    'Guided browser setup',
    'The installer opens a wizard that detects your browsers, registers the local connection automatically and opens the page and folder for loading the extension. It is also available in Settings.',
  ],
  'browser-quick-fill': [
    'Quick fill in browsers',
    'A customizable global shortcut, unlocking in a mini window and choosing accounts for the current HTTPS domain through the Chromium or Firefox extension. Fields are filled without submitting the sign-in.',
  ],
  'news-dialog': [
    "What's new and commit history inside JesseArchive",
    "Added the News button next to “Protected locally”: two tabs, What's new and Commits, with search, revision details and Git history you can browse offline.",
  ],
  'git-ready': [
    'Git history and GitHub repository',
    'Prepared the repository with the rebuilt project history, the commit messages, rules that keep vaults and sensitive files out, and tools for publishing the sources.',
  ],
  'generator-button': [
    'Bigger Generate button',
    'The main button of the password generator is larger, with text and click area that are easier to read and use even in small windows.',
  ],
  'beta-label': [
    'Beta stage labeled',
    'Added the “Version: Beta” label in Settings, with the number taken from the app version.',
  ],
  'version-file': [
    'Visible version and a simple installer name',
    'Added the version number in Settings and simplified the installer name to JesseArchive-Setup.exe.',
  ],
  'installer-images': [
    'Fixed installer graphics',
    'The original JesseArchive logo is now used in the installer sidebar and header, keeping its proportions.',
  ],
  'installer-folder': [
    'Selectable installation folder',
    'Added a setup screen to choose the installation path and pass it to the MSI package.',
  ],
  'category-create': [
    'New items in the right category',
    'From Accounts, Passkeys, Notes, Cards, Identities and Crypto, the editor selects the item type automatically; from the general views it can still be changed.',
  ],
  'inno-exe': [
    'EXE installer with Inno Setup',
    'Added distribution as a single setup EXE containing the Tauri MSI, avoiding the NSIS macro problem found in the builds.',
  ],
  offline: [
    'Windows installation even offline',
    "The MSI package now includes WebView2 offline, so other PCs don't need Node.js, Rust or a connection to download the runtime.",
  ],
  'msi-brand': [
    'Custom MSI installer',
    "Added custom images to the MSI wizard screens and kept the app's original logo.",
  ],
  cloud: [
    'Better search for local cloud folders',
    "Improved detection of OneDrive, Dropbox and other providers' folders and added clear messages when the search finds nothing.",
  ],
  history: [
    'History recovery made clear',
    "Replaced the confusing selector with “Use for account”: choose an archived password and confirm which local account to update. Added the developer's Instagram signature.",
  ],
  dialogs: [
    "Confirmation dialogs in the app's style",
    'Replaced the native Windows/browser pop-ups with theme-matched dialogs for deletions, checks, imports and other operations.',
  ],
  'clipboard-fixes': [
    'Clipboard handling fixes',
    'Fixed Rust incompatibilities found while testing the clipboard-win component.',
  ],
  clipboard: [
    'Copy passwords without CMD windows',
    'Removed the PowerShell processes used to copy and clear passwords on the Windows clipboard; added the eye icons to the group cards.',
  ],
  'theme-groups': [
    'Complete themes, logos and account groups',
    'Restored the original logo, introduced complete palettes and custom colors, groups by site/app with logos, renamed “Accesso” to “Account” and improved the scrollbars.',
  ],
  recovery: [
    'Recovery code confirmation fixed',
    'Fixed the recovery code confirmation button and prevented the window from closing by mistake before confirming.',
  ],
  'compat-fixture': [
    'Legacy vault compatibility test',
    'Fixed the path of the synthetic encrypted fixture used to check decryption of the original Python format.',
  ],
  'rust-keys': [
    'Rust cryptographic key fixes',
    'Fixed type and lifetime incompatibilities in the Rust port without changing the existing encryption format.',
  ],
  migration: [
    'Migration from Python to Rust and React',
    'Created the new Windows desktop project based on Rust, Tauri 2, React and TypeScript, supporting the original vault format.',
  ],
  legacy: [
    'Python project preserved',
    'Kept a copy of the original Python sources as a reference for the migration, without including the personal vault in the repository.',
  ],
};

export default news;
