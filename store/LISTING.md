# Schede per gli store dell'estensione

Testi pronti da copiare nel Chrome Web Store, nel sito dei componenti aggiuntivi di Firefox (AMO) e, se vuoi, in Microsoft Edge Add-ons.

- **Pacchetti:** `npm run package:store` crea in `store/out/` lo zip per Chrome/Edge (senza il campo `key`) e quello per Firefox.
- **Immagini:** sono in `store/images/`.
- **Informativa privacy:** [PRIVACY.md](../PRIVACY.md), indirizzo pubblico <https://github.com/jesseaims/Jesse-Archive/blob/main/PRIVACY.md>.

Nome e descrizione breve vengono dal manifest, tradotti in `browser-extension/_locales/`: lo store li prende da lì e non vanno riscritti.

---

## Descrizione lunga — italiano

Inserisci, salva e usa le passkey dei tuoi account direttamente dal vault di Jesse's Archive, il password manager per Windows che tiene i dati cifrati sul tuo computer.

**Richiede l'app desktop Jesse's Archive per Windows**, gratuita: <https://github.com/jesseaims/Jesse-Archive/releases/latest>. L'estensione da sola non contiene né salva password: fa da ponte fra la pagina e l'app.

Cosa fa:
• Inserimento rapido: seleziona il campo di accesso, premi la scorciatoia (Ctrl+Alt+J) o il pulsante dell'estensione e scegli l'account nella finestra dell'app. Vengono proposti solo gli account del sito aperto, e il login non viene mai inviato da solo.
• Salvataggio degli account: quando ti registri o accedi con una password nuova, l'app ti chiede se salvarla. Nulla viene salvato senza la tua conferma.
• Passkey: crea e usa le passkey dei siti salvandole nel vault cifrato, sempre con conferma; in alternativa si apre la finestra normale del browser.

Privacy e sicurezza:
• Funziona solo su pagine HTTPS.
• Nessun server, account, statistica o pubblicità: i dati passano solo all'app sullo stesso computer.
• Le credenziali restano nel vault cifrato con AES-256-GCM.
• Un riquadro di un altro sito non riceve mai le credenziali, e gli account salvati per un altro sottodominio sono segnalati.

Informativa: <https://github.com/jesseaims/Jesse-Archive/blob/main/PRIVACY.md>

## Descrizione lunga — English

Fill in, save and use passkeys for your accounts straight from the vault of Jesse's Archive, the Windows password manager that keeps your data encrypted on your computer.

**Requires the free Jesse's Archive desktop app for Windows**: <https://github.com/jesseaims/Jesse-Archive/releases/latest>. On its own the extension holds and saves no passwords: it is the bridge between the page and the app.

What it does:
• Quick fill: select the sign-in field, press the shortcut (Ctrl+Alt+J) or the extension button and pick the account in the app window. Only the accounts of the open site are offered, and the sign-in is never submitted for you.
• Account saving: when you sign up or sign in with a new password, the app asks whether to save it. Nothing is saved without your confirmation.
• Passkeys: create and use site passkeys stored in the encrypted vault, always with confirmation; otherwise the browser's normal dialog opens.

Privacy and security:
• Works on HTTPS pages only.
• No servers, accounts, statistics or ads: data goes only to the app on the same computer.
• Credentials stay in the AES-256-GCM encrypted vault.
• A frame of another site never receives credentials, and accounts saved for another subdomain are flagged.

Privacy policy: <https://github.com/jesseaims/Jesse-Archive/blob/main/PRIVACY.md>

---

## Chrome Web Store (vale anche per Microsoft Edge Add-ons)

**Categoria:** Strumenti (Tools); in Edge: Produttività.
**Lingua predefinita:** italiano; le altre lingue arrivano dal manifest.
**Sito / assistenza:** <https://github.com/jesseaims/Jesse-Archive>, problemi: <https://github.com/jesseaims/Jesse-Archive/issues>

### Scheda «Privacy»

**Scopo unico (single purpose)**
> Compila, salva e usa le passkey degli account nelle pagine HTTPS usando il vault locale dell'app desktop Jesse's Archive.
> *(EN) Fill in, save and use passkeys for accounts on HTTPS pages using the local vault of the Jesse's Archive desktop app.*

**Motivazione dei permessi** (inglese, come chiede lo store)

| Permesso | Testo |
|---|---|
| `nativeMessaging` | Required to talk to the Jesse's Archive desktop app installed on the same computer, which holds the encrypted vault. It is the extension's only channel: it sends the page address and receives the credentials the user picks in the app. |
| `scripting` | Used to read which sign-in field the user selected and to fill in the username and password the user chose in the app, in the active tab only and only after the user presses the shortcut or the extension button. |
| Host permission `https://*/*` | The user can sign in on any HTTPS site, and the fill is started from the desktop app's global shortcut, so activeTab cannot be used. The content scripts must also run on HTTPS pages to offer saving a submitted sign-in and to handle passkey (WebAuthn) requests when the site makes them. No HTTP, internal or file pages. |

**Codice remoto:** No, non uso codice remoto. Tutto il JavaScript è nel pacchetto.

**Uso dei dati: cosa raccoglie l'estensione.** Spunta solo:
- ☑ **Informazioni di autenticazione** (password, credenziali): passano fra la pagina e l'app locale per compilare e salvare.
- ☑ **Contenuti dei siti web**: indirizzo della pagina e campi del modulo di accesso.

Lascia senza spunta tutto il resto: dati personali identificativi, salute, finanze, comunicazioni personali, posizione, cronologia web, attività dell'utente.

**Le tre dichiarazioni** (spuntale tutte e tre):
- non vendo né trasferisco i dati a terzi, fuori dai casi consentiti;
- non uso né trasferisco i dati per scopi estranei allo scopo unico dell'estensione;
- non uso né trasferisco i dati per valutare l'affidabilità creditizia o per prestiti.

**URL informativa privacy:** <https://github.com/jesseaims/Jesse-Archive/blob/main/PRIVACY.md>

### Istruzioni per i revisori (campo «Test instructions» / note)

> This extension is the browser part of the Jesse's Archive desktop password manager (Windows) and needs the app to do anything.
> 1. Install the app: https://github.com/jesseaims/Jesse-Archive/releases/latest (JesseArchive-Setup.exe).
> 2. Open it, create a vault with any master password, add an account (Accounts → New) with website https://github.com, any username and password.
> 3. In the app: Settings → Desktop → "Set up browsers", choose Chrome (it registers the native messaging host).
> 4. Open https://github.com/login, click the username field and press Ctrl+Alt+J (or the extension button): the app window lists the account; press Enter to fill. The form is never submitted automatically.
> Without the app installed the extension shows no UI and stays idle.

---

## Firefox (addons.mozilla.org)

**Distribuzione:** «Su questo sito» (pubblica su AMO).
**Codice sorgente:** non serve inviarlo, perché i file JavaScript non sono minificati né compilati.
**Categorie:** Privacy e sicurezza; Altro.
**Riassunto (max 250 caratteri):**
> IT: Inserisci, salva e usa passkey dal vault cifrato di Jesse's Archive. Richiede l'app desktop per Windows. Solo HTTPS, nessun server, i dati restano sul tuo computer.
> EN: Fill in, save and use passkeys from the encrypted Jesse's Archive vault. Requires the Windows desktop app. HTTPS only, no servers, your data stays on your computer.

**Descrizione:** la stessa descrizione lunga di sopra.
**Licenza:** da scegliere tu. Se non vuoi una licenza open source, scegli «Tutti i diritti riservati».
**Informativa privacy:** incolla il testo di [PRIVACY.md](../PRIVACY.md).
**Raccolta dati:** il manifest dichiara `data_collection_permissions: none`. L'estensione non trasmette dati allo sviluppatore né a terzi, solo all'app locale tramite native messaging.

**Note per i revisori**

> Same as for Chrome: the extension needs the Jesse's Archive desktop app (Windows), which registers the native messaging host `com.jessearchive.browser` for the add-on ID `browser@jessearchive.local`. Steps: install https://github.com/jesseaims/Jesse-Archive/releases/latest, create a vault, add an account for https://github.com, run Settings → Desktop → "Set up browsers" and choose Firefox, then on https://github.com/login select the username field and press Ctrl+Alt+J. No remote code, no network requests from the extension.

---

## Immagini (`store/images/`)

| File | Formato | Dove |
|---|---|---|
| `icon-128.png` | 128×128 | Chrome, Edge (icona dello store) |
| `screenshot-1-inserimento.png` | 1280×800 | Chrome, Edge, Firefox |
| `screenshot-2-salvataggio.png` | 1280×800 | Chrome, Edge, Firefox |
| `screenshot-3-passkey.png` | 1280×800 | Chrome, Edge, Firefox |
| `promo-440x280.png` | 440×280 | Chrome «Small promo tile», Edge |
