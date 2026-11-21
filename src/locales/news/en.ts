import type { NewsTranslations } from '../../news-changelog';

// English titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'generator-checks': [
    'More accurate password generator and check',
    'The generator no longer creates trivial PINs like 000000 or 123456, and the «Unique characters» option also works with lengths close to the number of available characters, where before it often gave an error. The estimated bits of generated passwords are now a prudent estimate that accounts for the chosen options. The password health check also recognises common passwords with small changes (like «Password123!», «p4ssw0rd» or a name followed by a year), repetitions and keyboard sequences: some passwords considered strong before may now show up as weak.',
  ],
  'password-bulk-select': [
    'Password archive easier to clean up',
    'In the Password archive, the «Select all» button selects at once every deletable password shown, also when filtered by the search, so you can clean up the history without ticking them one by one. The current passwords of accounts can’t be selected: change them in the account. After deleting, the app tells you how many passwords it removed. Also, deleting an item for good (including by emptying the trash) now deletes its passwords in the history too, instead of leaving them as unlinked passwords.',
  ],
  'css-cleanup': [
    'Style sheet cleaned up',
    'Rules that no longer had any effect were removed from the interface style: properties always overridden by later rules and the style of an element that no longer exists. The app looks exactly the same, and an automatic check verified it rule by rule.',
  ],
  'legacy-python-removed': [
    'The old Python version removed from the source code',
    'The first version of Jesse’s Archive, written in Python, is no longer part of the source code: the app did not use it and it made maintenance harder. It is still available in the project history. Vaults created with that version still open, and a test checks it at every change. Nothing changes for people using the app.',
  ],
  'export-keeps-groups': [
    'Exported files keep groups and favorites',
    'When you export the vault as CSV and import it again, accounts of apps and services without a website (for example several accounts of the same game) go back into their named group instead of each ending up in a separate group, and favorites stay favorites. The JSON export now also keeps group names and icons. Also, items deleted and then imported again from a JSON file no longer disappear at the next save.',
  ],
  'window-permissions': [
    'Each window can only do its own job',
    'The browser mini window, Quick Search and the extension guide can now use only the functions each one needs: for example, they can no longer export the vault, read passwords they do not show, edit items or change the master password. All of this is still possible only from the main window. Nothing changes in everyday use.',
  ],
  'group-favorites': [
    'Favorites straight from the account groups',
    'In the grouped view of accounts, each account has a star to add it to or remove it from favorites, and the star next to the group name adds or removes all its accounts at once, without opening them one by one.',
  ],
  'ui-secrets-on-demand': [
    'Passwords no longer stay open in the main window',
    'The main window now receives only the names, usernames and addresses of your items. Passwords, PINs, CVVs, card numbers, seed phrases, TOTP codes and note text stay in the app’s engine, separate from the interface, until you show them, copy them or open the item to edit it, and they are forgotten when you close the item or lock the vault. Passwords copied from the account cards and from the history go straight to the clipboard without passing through the window. Search still finds words written in notes.',
  ],
  'vault-scrypt-rollback': [
    'Master password harder to crack and a warning about old copies',
    'At the first unlock, the master password protection moves to a calculation four times heavier (scrypt with 128 MB of memory): anyone who gets a copy of the vault needs much longer to try passwords. Unlocking may take a fraction of a second longer. New .jshare packages use this protection too. If the vault file is replaced with an older copy of itself (for example in the cloud folder), a warning appears when you open it. Also, a change not saved because the file was busy is now saved at the next synchronization. If you use the vault on several PCs, update all of them: after the first unlock with this version, earlier ones can no longer open it.',
  ],
  'vault-header-key-rotation': [
    'Stronger protection when you change the master password',
    'The vault header is now signed with a key only you can obtain: an old copy placed in the vault folder (for example by someone with access to your cloud) can no longer bring back an old master password. When you change the master password you can tick “The old password may have been discovered”: the key that encrypts the data changes too, so the old password no longer opens the vault, not even from a copy, and you get a new recovery code to save. A new recovery code always changes the key as well. If you use the vault on several PCs, update all of them first.',
  ],
  'universal-import': [
    'Import from the main password managers',
    'The import now recognizes the files of Bitwarden (CSV and unencrypted JSON), LastPass, 1Password, Dashlane, NordPass, Proton Pass, KeePass and KeePassXC (CSV and XML), RoboForm and of Chrome, Edge, Brave, Opera, Firefox and Apple Passwords. Before importing, a preview shows the program it recognized and how many items it found; for CSV files you can check and change which field each column goes to, so files from other programs work too.',
  ],
  'bulk-select-accounts': [
    'Select many accounts at once',
    'In “All items” and “Accounts” you can now select whole groups or single accounts with their checkbox, or everything you see with “Select all” (search results too), then move them to the trash or to a folder in one go.',
  ],
  'kaspersky-import': [
    'Import from Kaspersky Password Manager',
    'Jesse’s Archive now imports the text file (.txt) that Kaspersky Password Manager creates with “Export to text file”: websites, applications and other accounts become accounts with name, address, username, password and comments, and Kaspersky notes become notes. Delete the exported file afterwards: it contains your passwords in clear text.',
  ],
  'unlock-throttling': [
    'Protection against password guessing',
    'After 5 wrong attempts in a row at unlocking the vault (master password or recovery code), Jesse’s Archive makes you wait 30 seconds before the next try, doubling each time up to 15 minutes. The count survives restarting the app and is cleared by the first correct unlock.',
  ],
  'save-new-logins': [
    'Save new accounts from the browser',
    'When you sign up on a site, or sign in with an account that is not in the vault yet, Jesse’s Archive asks whether to save it: name, username or email, password and, if you want, the other details you entered go into a new account for that site. If you change a password on a site, it offers to update the saved one. Nothing is saved without your confirmation, and you can turn it off or exclude sites in Settings. Requires the updated extension.',
  ],
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
