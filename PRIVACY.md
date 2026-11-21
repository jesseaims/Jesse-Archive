# Informativa sulla privacy — Jesse's Archive

*English version below.*

Ultimo aggiornamento: 21 novembre 2026. Versione pubblicata: <https://jessearchive.it/privacy-estensione/>.

Questa informativa riguarda l'estensione per browser **JesseArchive · Inserimento rapido** e l'app desktop **Jesse's Archive**. L'estensione funziona solo insieme all'app desktop, installata sullo stesso computer.

## In breve

- L'estensione **non invia dati allo sviluppatore né a terzi**: non ha server, account, statistiche d'uso o pubblicità.
- Tutto quello che legge viene passato **solo all'app Jesse's Archive sullo stesso computer**, tramite il canale «native messaging» del browser.
- Le credenziali restano nel vault cifrato (AES-256-GCM) sul tuo computer, o nella cartella che scegli tu per sincronizzarlo.

## Cosa legge l'estensione e quando

| Dato | Quando | A cosa serve |
|---|---|---|
| Indirizzo della pagina e del riquadro del campo selezionato | Quando premi la scorciatoia dell'app o il pulsante dell'estensione su una pagina HTTPS | Mostrare nell'app solo gli account di quel sito |
| Campo di accesso selezionato | Come sopra | Inserire username e password dell'account **che scegli tu** nell'app; il login non viene mai inviato automaticamente |
| Username, password e altri campi digitati in un modulo con password | Quando invii il modulo su una pagina HTTPS, solo se nell'app è attiva l'opzione «Proponi di salvare gli account nuovi e le password cambiate sui siti» | Proporti di salvarli nel vault; **nulla viene salvato senza la tua conferma** nell'app |
| Richiesta di passkey (WebAuthn) di un sito | Quando un sito HTTPS chiede di creare o usare una passkey | Crearla o usarla dal vault dopo la tua conferma nell'app; altrimenti si apre la finestra normale del browser |

L'estensione non legge pagine HTTP, pagine interne del browser o file locali. Non legge la cronologia, i cookie o altre schede. Non salva dati sul disco: tiene in memoria per qualche minuto solo l'username di un accesso in due passaggi, per abbinarlo alla password del passaggio successivo.

## L'app desktop

L'app conserva i dati nel vault cifrato sul tuo computer e non ha un servizio cloud proprio. Si collega a Internet solo per queste funzioni:

- controllo degli aggiornamenti su GitHub, che si può disattivare;
- verifica delle password violate con Have I Been Pwned, solo quando la avvii tu: escono solo i primi 5 caratteri dell'hash SHA-1, mai la password;
- icone dei siti, solo con l'opzione «Scarica favicon dei siti (rete)».

Se scegli una cartella sincronizzata (OneDrive, Google Drive…), il file del vault cifrato viene gestito da quel servizio secondo le sue condizioni.

## Conservazione e cancellazione

I dati restano nel vault finché non li elimini dall'app. Disinstallando l'estensione non resta nulla nel browser. Disinstallando l'app, il vault resta nella cartella dei dati finché non lo elimini tu.

## Contatti

Domande sulla privacy: le email indicate in <https://jessearchive.it/supporto/>. Segnalazioni tecniche: <https://github.com/jesseaims/Jesse-Archive/issues>

---

# Privacy policy — Jesse's Archive

Last updated: 21 November 2026. Published version: <https://jessearchive.it/en/privacy-estensione/>.

This policy covers the browser extension **JesseArchive · Quick fill** and the desktop app **Jesse's Archive**. The extension only works together with the desktop app, installed on the same computer.

## In short

- The extension **does not send data to the developer or to third parties**: it has no servers, accounts, usage statistics or ads.
- Everything it reads goes **only to the Jesse's Archive app on the same computer**, through the browser's "native messaging" channel.
- Credentials stay in the encrypted vault (AES-256-GCM) on your computer, or in the folder you choose to sync it.

## What the extension reads, and when

| Data | When | Purpose |
|---|---|---|
| Address of the page and of the frame holding the selected field | When you press the app shortcut or the extension button on an HTTPS page | Show in the app only the accounts of that site |
| The selected sign-in field | As above | Fill in the username and password of the account **you choose** in the app; the sign-in is never submitted automatically |
| Username, password and other fields typed into a form with a password | When you submit the form on an HTTPS page, only if the app option to offer saving new accounts and changed passwords is on | Offer to save them in the vault; **nothing is saved without your confirmation** in the app |
| A site's passkey (WebAuthn) request | When an HTTPS site asks to create or use a passkey | Create or use it from the vault after your confirmation in the app; otherwise the browser's normal dialog opens |

The extension does not read HTTP pages, internal browser pages or local files. It does not read your history, cookies or other tabs. It saves nothing to disk: it only keeps the username of a two-step sign-in in memory for a few minutes, to pair it with the password of the next step.

## The desktop app

The app keeps your data in the encrypted vault on your computer and has no cloud service of its own. It connects to the Internet only for these features:

- update checks on GitHub, which can be turned off;
- breached-password checks with Have I Been Pwned, only when you start one: only the first 5 characters of the SHA-1 hash leave the device, never the password;
- site icons, only with the option to download site favicons.

If you choose a synced folder (OneDrive, Google Drive…), the encrypted vault file is handled by that service under its own terms.

## Retention and deletion

Data stays in the vault until you delete it in the app. Uninstalling the extension leaves nothing in the browser. Uninstalling the app keeps the vault in the data folder until you delete it.

## Contact

Privacy questions: the email addresses listed at <https://jessearchive.it/supporto/>. Technical reports: <https://github.com/jesseaims/Jesse-Archive/issues>
