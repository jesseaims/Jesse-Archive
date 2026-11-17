# Inserimento rapido nel browser (Windows)

## Installazione

1. Installa il nuovo `JesseArchive-Setup.exe`. Nella schermata finale lascia selezionato **Configura le estensioni dei browser**. La procedura usa normalmente l'utente Windows che ha avviato il setup; con installazione silenziosa non viene avviata. Se lanci il setup esplicitamente con "Esegui come amministratore" usando un altro account, apri invece la procedura dalle Impostazioni nella tua sessione normale.
2. Il collegamento locale viene registrato automaticamente per il tuo utente. Puoi riaprire la procedura da **Impostazioni → Desktop → Configura i browser** senza ripetere l'installazione. Non occorre sbloccare il vault nella procedura guidata.
3. Seleziona un browser rilevato. Si aprono la sua pagina delle estensioni e la cartella corretta, già inclusa nell'installazione. Il percorso viene copiato automaticamente negli appunti: puoi incollarlo nel selettore con Ctrl+V. Il pulsante **Copia percorso** permette di copiarlo di nuovo.
4. Per Chrome, Edge, Brave, Opera e Vivaldi, attiva la modalità sviluppatore e scegli **Carica estensione non pacchettizzata**, indicando la cartella `chromium` aperta dalla procedura. Il caricamento rimane configurato per i successivi avvii del browser e usa i file nella cartella del programma: non spostarli. I browser portatili o non rilevati possono essere configurati manualmente con gli stessi file.
5. Per Firefox, in **Questo Firefox** premi **Carica componente aggiuntivo temporaneo** e scegli `firefox/manifest.json` nella cartella aperta. **Questo caricamento scade al riavvio del browser.** Per un'installazione permanente serve la firma Mozilla del pacchetto Firefox, ottenibile anche senza pubblicazione nell'elenco pubblico. La firma non è inclusa in questa versione.
6. Se il browser non si collega, usa **Ripara collegamento browser** nelle Impostazioni e riavvia il browser. Nelle Impostazioni deve comparire un collegamento attivo.

La procedura non modifica i profili, non forza la modalità sviluppatore e non installa criteri aziendali. Copiare file nella cartella interna delle estensioni del browser non completa l'attivazione. Per questa distribuzione locale i clic indicati al punto 4 (o il caricamento temporaneo Firefox) rimangono necessari.

Il pulsante nella barra strumenti dell'estensione apre lo stesso pannello, ma per conservare il campo selezionato è preferibile usare la scorciatoia.

## Utilizzo

- Salva nell'account di JesseArchive l'URL HTTPS del sito di accesso. Sono suggeriti solo gli account del dominio esatto (con o senza `www`); ad esempio `accounts.google.com` richiede quell'URL, non `google.com`.
- Seleziona il campo username o password nel sito e premi **Ctrl+Alt+J**. Puoi cambiare la combinazione nelle Impostazioni. Se è già occupata viene mostrato un errore e rimane quella precedente.
- Se il vault è bloccato, inserisci la password principale nella mini finestra nativa. Non viene inviata al browser.
- Cerca e scorri gli account con il mouse o ↑/↓. Premi Invio o fai clic sull'account per inserire le credenziali. Esc annulla.
- Su una schermata con entrambi i campi l'estensione compila username e password e sposta il focus alla password. Non preme Invio e non invia il modulo.
- Nei login su più schermate compila prima lo username; continua sul sito, seleziona il campo password e richiama il pannello per scegliere nuovamente l'account.
- Le richieste scadono dopo due minuti. Un cambio di URL, scheda o modulo richiede una nuova richiesta.

## Limiti e verifica

Sono esclusi HTTP, pagine interne del browser, iframe con origine diversa dalla pagina principale, campi non modificabili e moduli ambigui con più password o password nuova. L'integrazione non implementa WebAuthn/passkey, CAPTCHA, MFA o un login automatico. Le pagine che bloccano le estensioni e alcuni controlli personalizzati richiedono la copia manuale dall'app.

Il codice usa le API WebExtensions per Chromium e Firefox. La compatibilità effettiva deve essere verificata nelle versioni installate dei sei browser: la compilazione non sostituisce questo collaudo.

Checklist manuale con account sintetici:

- Vault bloccato/sbloccato, app nell'area di notifica, scorciatoia personalizzata e già occupata.
- Ricerca, rotella, frecce, Invio ed Esc; più account per lo stesso dominio.
- Login nella stessa pagina e in due passaggi; Unicode nello username/password; input React controllati.
- Cambio URL, cambio scheda, chiusura browser, timeout e disconnessione prima della scelta.
- Nessuna proposta per domini simili, HTTP, iframe estranei, cestino e moduli di registrazione.
- Installazione/aggiornamento/disinstallazione del setup e riavvio del browser.

## Architettura e riferimenti

L'estensione parla esclusivamente con `com.jessearchive.browser` via Native Messaging. Un helper senza interfaccia inoltra messaggi incorniciati a un socket loopback locale autenticato con un token casuale per ogni avvio dell'app. Il token è nella cartella AppData dell'utente, non nell'estensione e non nelle pagine web. Il canale non offre HTTP, CORS o API del vault generiche. Il backend consegna solo la credenziale selezionata nella finestra nativa, con corrispondenza del dominio e richiesta non scaduta. L'estensione ricontrolla pagina e campo prima di compilare. Nessun segreto viene conservato nello storage dell'estensione o negli appunti.

Il manifest Chromium contiene una chiave **pubblica**, usata per mantenere stabile l'ID durante il caricamento in modalità sviluppatore. Non rigenerarla: cambierebbe l'ID autorizzato. La distribuzione tramite store potrebbe richiedere un aggiornamento dell'ID autorizzato nel componente desktop.

I registri Native Messaging sono sotto `HKCU\Software\…\NativeMessagingHosts\com.jessearchive.browser`; i manifest sotto `%APPDATA%\JesseArchive\browser`. Per rimuovere completamente il collegamento, elimina queste sole chiavi e la cartella `browser`, dopo aver chiuso app e browser. Il vault è separato.

- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Firefox Native Messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging)
- [Tauri global shortcuts](https://v2.tauri.app/plugin/global-shortcut/)
