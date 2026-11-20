/** Curated user-facing changelog. Add an entry when publishing a new update.
 * These are development milestones, not independent security audit claims. */
export type NewsEntry = {
  id: string;
  version: string;
  title: string;
  description: string;
  addedAt: string;
  dateSource?: 'git';
  icon: 'sparkles' | 'shield' | 'palette' | 'folder' | 'package' | 'wrench' | 'key' | 'cloud';
};

/** Title and description of each entry in another language, by entry id
 * (src/locales/news/<lang>.ts); Italian is the text below. */
export type NewsTranslations = Record<string, [title: string, description: string]>;

export const NEWS_ENTRIES: NewsEntry[] = [
  {
    id: 'kaspersky-import',
    addedAt: '2026-11-20T18:00:00+01:00',
    version: 'Beta 1.4.0',
    title: 'Importa da Kaspersky Password Manager',
    description:
      'Jesse’s Archive ora importa il file di testo (.txt) che Kaspersky Password Manager crea con «Esporta in file di testo»: siti web, applicazioni e altri account diventano account con nome, indirizzo, username, password e commenti, e le note di Kaspersky diventano note. Dopo l’import elimina il file esportato: contiene le tue password in chiaro.',
    icon: 'package',
  },
  {
    id: 'unlock-throttling',
    addedAt: '2026-11-20T17:00:00+01:00',
    version: 'Beta 1.4.0',
    title: 'Protezione contro chi prova a indovinare la password',
    description:
      'Dopo 5 tentativi errati di fila di sbloccare il vault (password principale o codice di recupero), Jesse’s Archive fa attendere 30 secondi prima del tentativo successivo, il doppio ogni volta fino a 15 minuti. Il conteggio resta anche riavviando l’app e si azzera al primo sblocco corretto.',
    icon: 'shield',
  },
  {
    id: 'save-new-logins',
    addedAt: '2026-11-20T12:00:00+01:00',
    version: 'Beta 1.3.0',
    title: 'Salva i nuovi account dal browser',
    description:
      'Quando ti registri su un sito, o accedi con un account che non è ancora nel vault, Jesse’s Archive ti chiede se salvarlo: nome, username o email, password e, se vuoi, gli altri dati inseriti diventano un nuovo account per quel sito. Se cambi una password su un sito, propone di aggiornare quella salvata. Niente viene salvato senza la tua conferma, e nelle Impostazioni puoi disattivarlo o escludere dei siti. Richiede l’estensione aggiornata.',
    icon: 'key',
  },
  {
    id: 'installer-sharper-images',
    addedAt: '2026-11-19T18:00:00+01:00',
    version: 'Beta 1.2.1',
    title: 'Immagini dell’installer più nitide',
    description:
      'Il logo e il nome sul lato del setup ora sono nitidi: vengono dall’illustrazione originale e sono preparati alla misura esatta per ogni scala dello schermo, così Windows non deve più stirarli.',
    icon: 'palette',
  },
  {
    id: 'new-installer',
    addedAt: '2026-11-19T17:00:00+01:00',
    version: 'Beta 1.2.0',
    title: 'Nuovo installer nello stile dell’app',
    description:
      'Il setup è stato rifatto: una sola finestra dall’inizio alla fine, con il tema scuro e il logo di Jesse’s Archive, al posto della procedura che passava da Windows Installer. Ora ha anche una propria disinstallazione, che rimuove il programma senza toccare vault e impostazioni. Aggiornando dalla versione precedente non devi fare nulla: il nuovo setup sostituisce quella vecchia nella stessa cartella.',
    icon: 'package',
  },
  {
    id: 'extension-logo-autoreload',
    addedAt: '2026-11-19T15:00:00+01:00',
    version: 'Beta 1.1.21',
    title: 'Logo dell’estensione e ricaricamento automatico',
    description:
      'L’estensione del browser mostra ora il logo di Jesse’s Archive nella barra e nell’elenco delle estensioni. Dopo ogni aggiornamento si ricarica da sola appena si collega all’app, senza doverlo fare a mano dalla pagina delle estensioni. Per questa volta ricaricala ancora a mano: il ricaricamento automatico vale dai prossimi aggiornamenti.',
    icon: 'package',
  },
  {
    id: 'breach-check-autofill-fixes',
    addedAt: '2026-11-19T13:00:00+01:00',
    version: 'Beta 1.1.20',
    title: 'Verifica violazioni e inserimento più affidabili',
    description:
      'La verifica degli account compromessi ora funziona anche con vault grandi (prima si interrompeva con «Impossibile contattare Pwned Passwords» oltre circa 120 password) e riprova da sola se la rete ha un intoppo. L’inserimento dal browser riconosce anche i campi di accesso dei siti costruiti con componenti web, come Reddit, e i riquadri di accesso di un sottodominio dello stesso sito, come quello di Ubisoft. Dopo l’aggiornamento ricarica l’estensione dalla pagina delle estensioni del browser.',
    icon: 'wrench',
  },
  {
    id: 'global-quick-search',
    addedAt: '2026-11-18T19:00:00+01:00',
    version: 'Beta 1.1.19',
    title: 'Ricerca rapida globale',
    description:
      'Premi Ctrl+Shift+Space da qualsiasi applicazione, anche con Jesse’s Archive nell’area di notifica, per aprire una finestra di ricerca compatta: trovi gli account per nome, username, email o sito, con gli account dello stesso servizio raggruppati, e copi username o password, mostri la password per qualche secondo, apri il sito o apri l’elemento nel vault, tutto da tastiera. Funziona solo con il vault sbloccato, le password vengono copiate senza passare dalla finestra e gli appunti si svuotano come sempre. Scorciatoia e opzioni sono in Impostazioni → Ricerca rapida globale.',
    icon: 'sparkles',
  },
  {
    id: 'window-state',
    addedAt: '2026-11-18T16:40:00+01:00',
    version: 'Beta 1.1.18',
    title: 'La finestra ricorda dimensione e posizione',
    description:
      'Jesse’s Archive si riapre come l’hai lasciato: a schermo intero, massimizzato oppure con la dimensione e la posizione che avevi scelto, anche dopo essere passato dal tray. Se lo schermo su cui si trovava non è più collegato, la finestra si apre al centro di quello disponibile.',
    icon: 'wrench',
  },
  {
    id: 'customizable-dashboard',
    addedAt: '2026-11-18T03:03:12+01:00',
    version: 'Beta 1.1.17',
    title: 'Dashboard personalizzabile',
    description:
      'La nuova Dashboard è il centro di controllo dell’app: punteggio di sicurezza, analisi delle password, panoramica del vault, preferiti, elementi recenti, note protette, azioni rapide, generatore, stato del backup e privacy. Con «Personalizza dashboard» aggiungi, rimuovi, trascini e ridimensioni i widget, scegli fra più layout e regoli le opzioni di ciascuno; tutto si salva da solo nel vault cifrato e nessun widget mostra le password.',
    icon: 'sparkles',
  },
  {
    id: 'multilanguage',
    addedAt: '2026-11-18T02:14:17+01:00',
    version: 'Beta 1.1.16',
    title: 'Jesse’s Archive parla la tua lingua',
    description:
      'Con il nuovo pulsante «Lingua» in alto a destra scegli fra italiano, inglese, spagnolo, francese, tedesco, portoghese, russo, cinese, giapponese e coreano. Tutta l’app cambia subito, comprese la schermata di sblocco, la mini finestra del browser e il menu nell’area di notifica; al primo avvio viene usata la lingua di Windows. Anche l’installer e l’estensione del browser seguono la lingua del sistema.',
    icon: 'sparkles',
  },
  {
    id: 'installer-logo',
    addedAt: '2026-11-18T01:31:43+01:00',
    version: 'Beta 1.1.15',
    title: 'Logo dell’installer sistemato',
    description:
      'Nell’installazione il logo in alto a destra non appare più schiacciato: ora è il logo dell’app, nitido e nelle giuste proporzioni anche con lo schermo ingrandito.',
    icon: 'palette',
  },
  {
    id: 'webauthn-passkeys',
    addedAt: '2026-11-18T01:01:38+01:00',
    version: 'Beta 1.1.14',
    title: 'Passkey nei siti web',
    description:
      'Quando un sito propone una passkey, Jesse’s Archive apre la mini finestra: puoi salvarla nel vault cifrato e usarla per accedere, oppure scegliere «Usa un altro dispositivo» per telefono o Windows Hello. Ogni uso richiede la tua conferma. Ricarica l’estensione nel browser dopo l’aggiornamento; su Firefox serve la versione 128 o successiva. Si disattiva in Impostazioni → Desktop.',
    icon: 'key',
  },
  {
    id: 'auto-update',
    addedAt: '2026-11-18T00:45:49+01:00',
    version: 'Beta 1.1.13',
    title: 'Aggiornamenti automatici',
    description:
      'L’app controlla le nuove versioni all’avvio e una volta al giorno e ti chiede se installarle: con «Aggiorna ora» scarica il setup, ne verifica la firma digitale dell’autore e si riapre aggiornata. In Impostazioni → Aggiornamenti puoi cercarle a mano o disattivare il controllo automatico.',
    icon: 'package',
  },
  {
    id: 'zoom-typed-min-max',
    addedAt: '2026-11-17T21:00:25+01:00',
    version: 'Beta 1.1.12',
    title: 'Zoom a scelta, minimo e massimo',
    description:
      'In Impostazioni → Aspetto puoi scrivere la percentuale di zoom che preferisci (da 50 a 200) e usare i due nuovi pulsanti per passare subito allo zoom minimo o massimo.',
    icon: 'sparkles',
  },
  {
    id: 'interface-zoom',
    addedAt: '2026-11-17T20:50:56+01:00',
    version: 'Beta 1.1.11',
    title: 'Zoom dell’interfaccia',
    description:
      'Ingrandisci o riduci l’app con Ctrl + + e Ctrl + − (oppure Ctrl + F12 / Ctrl + F11 o Ctrl + rotella del mouse) e torna al 100% con Ctrl + 0. Lo trovi anche in Impostazioni → Aspetto: vale per tutte le finestre e viene ricordato su questo PC.',
    icon: 'sparkles',
  },
  {
    id: 'empty-trash',
    addedAt: '2026-11-17T20:36:53+01:00',
    version: 'Beta 1.1.10',
    title: 'Svuota cestino',
    description:
      'Nella pagina Cestino il pulsante «Svuota cestino» elimina definitivamente tutti gli elementi in un colpo solo, dopo due conferme che mostrano cosa verrà eliminato.',
    icon: 'wrench',
  },
  {
    id: 'settings-layout-installer-flow',
    addedAt: '2026-11-17T19:55:45+01:00',
    version: 'Beta 1.1.9',
    title: 'Impostazioni più compatte e installazione più comoda',
    description:
      'Le schede delle Impostazioni si dispongono senza spazi vuoti. L’installazione offre la spunta per avviare l’app al termine, e la guida delle estensioni ha il pulsante «Ho installato l’estensione» che la chiude e apre Jesse’s Archive.',
    icon: 'sparkles',
  },
  {
    id: 'refresh-feedback-appearance',
    addedAt: '2026-11-17T19:36:12+01:00',
    version: 'Beta 1.1.8',
    title: 'Pulsante Aggiorna con esito e nuova scheda Aspetto',
    description:
      'Il pulsante Aggiorna mostra cosa ha fatto: se ha trovato elementi nuovi, modificati o rimossi, oppure che era già tutto aggiornato, e in caso di problemi spiega cosa è andato storto. Temi e colori dell’app hanno ora una scheda dedicata, Aspetto, nelle Impostazioni.',
    icon: 'palette',
  },
  {
    id: 'regroup-on-site-change',
    addedAt: '2026-11-17T19:23:50+01:00',
    version: 'Beta 1.1.7',
    title: 'Il sito di un account si aggiorna quando lo modifichi',
    description:
      'Se cambi il sito web di un account, nella raccolta compare subito sotto il nuovo sito invece di restare in quello inserito all’inizio. Si sistemano da sole anche le voci già salvate in precedenza.',
    icon: 'wrench',
  },
  {
    id: 'delete-accounts-and-groups',
    addedAt: '2026-11-17T19:10:00+01:00',
    version: 'Beta 1.1.6',
    title: 'Eliminazione di account, gruppi ed elementi',
    description:
      'Ogni gruppo di account ha il pulsante «Elimina account» per il singolo account e un cestino per eliminare l’intero gruppo, con doppia conferma che elenca cosa verrà eliminato. Anche gli elementi delle altre categorie si eliminano con un clic e una conferma. Tutto finisce nel Cestino, da dove si può ripristinare.',
    icon: 'wrench',
  },
  {
    id: 'session-hardening',
    addedAt: '2026-11-17T18:19:27+01:00',
    version: 'Beta 1.1.5',
    title: 'Blocco automatico più affidabile e importazioni più sicure',
    description:
      'Il vault si blocca davvero dopo il tempo di inattività scelto, anche con la finestra nascosta, e lo schermo viene svuotato. Tastiera, clic e scorrimento contano come attività. Un file da importare con anche un solo elemento non valido viene rifiutato senza modificare il vault, e la lunghezza minima delle password ora conta correttamente le lettere accentate.',
    icon: 'shield',
  },
  {
    id: 'news-entry-timestamps',
    addedAt: '2026-11-17T12:43:14Z',
    version: 'Beta 1.1.4',
    title: 'Data e ora per ogni novità e commit',
    description:
      'Ogni voce delle schede Novità e Commit mostra in basso a destra la propria data e ora, con testo leggibile. Gli orari restano fissi tra una compilazione e la successiva.',
    icon: 'sparkles',
  },
  {
    id: 'browser-site-matching',
    addedAt: '2026-11-17T06:20:56+01:00',
    dateSource: 'git',
    version: 'Beta 1.1.3',
    title: 'Account riconosciuti tra dominio e sottodomini',
    description:
      'Gli indirizzi salvati senza protocollo vengono riconosciuti e gli account sono proposti anche sulle pagine di accesso dei sottodomini dello stesso sito, come Epic Games Store. Il confronto distingue domini estranei e servizi con sottodomini indipendenti.',
    icon: 'wrench',
  },
  {
    id: 'browser-extension-navigation',
    addedAt: '2026-11-17T06:11:12+01:00',
    dateSource: 'git',
    version: 'Beta 1.1.2',
    title: 'Apertura corretta della pagina estensioni',
    description:
      'La guida apre una nuova finestra del browser scelto e raggiunge la sua pagina delle estensioni dalla barra degli indirizzi. Aggiunti indirizzo copiabile e pulsante per riprovare.',
    icon: 'wrench',
  },
  {
    id: 'browser-setup-wizard',
    addedAt: '2026-11-17T06:00:58+01:00',
    dateSource: 'git',
    version: 'Beta 1.1.1',
    title: 'Configurazione guidata dei browser',
    description:
      'Il setup apre una procedura che rileva i browser, registra automaticamente il collegamento locale e apre pagina e cartella per caricare l’estensione. Disponibile anche nelle Impostazioni.',
    icon: 'package',
  },
  {
    id: 'browser-quick-fill',
    addedAt: '2026-11-17T06:00:58+01:00',
    dateSource: 'git',
    version: 'Beta 1.1.0',
    title: 'Inserimento rapido nei browser',
    description:
      'Scorciatoia globale personalizzabile, sblocco in una mini finestra e selezione degli account per il dominio HTTPS corrente tramite estensione Chromium o Firefox. Compilazione senza inviare il login.',
    icon: 'key',
  },
  {
    id: 'news-dialog',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'Beta 1.0.3',
    title: 'Novità e cronologia commit dentro JesseArchive',
    description:
      'Aggiunto il pulsante News accanto a «Protetto localmente»: due schede, Novità e Commit, con ricerca, dettagli delle revisioni e cronologia Git consultabile offline.',
    icon: 'sparkles',
  },
  {
    id: 'git-ready',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'Beta 1.0.2',
    title: 'Cronologia Git e repository GitHub',
    description:
      'Preparata la repository con la storia ricostruita del progetto, i messaggi di commit, le regole per escludere vault e file sensibili e gli strumenti per pubblicare i sorgenti.',
    icon: 'wrench',
  },
  {
    id: 'generator-button',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'Beta 1.0.2',
    title: 'Pulsante Genera più grande',
    description:
      'Ingrandito il pulsante principale del generatore di password, con testo e area di clic più leggibili anche su finestre ridotte.',
    icon: 'sparkles',
  },
  {
    id: 'beta-label',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'Beta 1.0.2',
    title: 'Identificata la fase Beta',
    description:
      'Aggiunta nelle Impostazioni la dicitura «Version: Beta», con il numero letto dalla versione dell’app.',
    icon: 'wrench',
  },
  {
    id: 'version-file',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: '1.0.2',
    title: 'Versione visibile e setup dal nome semplice',
    description:
      'Aggiunto il numero di versione nelle Impostazioni e semplificato il nome dell’installer in JesseArchive-Setup.exe.',
    icon: 'package',
  },
  {
    id: 'installer-images',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: '1.0.2',
    title: 'Grafica dell’installer corretta',
    description:
      'Usato il logo originale di JesseArchive nella barra laterale e nella testata dell’installer, mantenendone le proporzioni.',
    icon: 'palette',
  },
  {
    id: 'installer-folder',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: '1.0.2',
    title: 'Cartella di installazione selezionabile',
    description:
      'Aggiunta al setup una schermata per scegliere il percorso di installazione e passarlo al pacchetto MSI.',
    icon: 'folder',
  },
  {
    id: 'category-create',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: '1.0.2',
    title: 'Nuovi elementi nella categoria giusta',
    description:
      'Da Account, Passkey, Note, Carte, Identità e Crypto l’editor seleziona automaticamente il tipo dell’elemento; dalle viste generali resta modificabile.',
    icon: 'sparkles',
  },
  {
    id: 'inno-exe',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: '1.0.2',
    title: 'Installer EXE con Inno Setup',
    description:
      'Aggiunta la distribuzione tramite un singolo setup EXE che contiene l’MSI Tauri, evitando il problema delle macro NSIS riscontrato nelle build.',
    icon: 'package',
  },
  {
    id: 'offline',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: '1.0.2',
    title: 'Installazione Windows anche offline',
    description:
      'Configurato il pacchetto MSI per includere WebView2 offline, così gli altri PC non devono avere Node.js, Rust o una connessione per scaricare il runtime.',
    icon: 'package',
  },
  {
    id: 'msi-brand',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v5.5',
    title: 'Installer MSI personalizzato',
    description:
      'Inserite immagini personalizzate per le schermate del wizard MSI e mantenuto il logo originale dell’app.',
    icon: 'palette',
  },
  {
    id: 'cloud',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v5.5',
    title: 'Ricerca delle cartelle cloud locali migliorata',
    description:
      'Ampliato il rilevamento delle cartelle OneDrive, Dropbox e altri provider e aggiunti messaggi espliciti quando la ricerca non trova risultati.',
    icon: 'cloud',
  },
  {
    id: 'history',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v5.4',
    title: 'Recupero dallo storico reso comprensibile',
    description:
      'Sostituito il selettore poco chiaro con «Usa per account»: scegli una password archiviata e confermi quale account locale aggiornare. Aggiunta la firma Instagram dello sviluppatore.',
    icon: 'key',
  },
  {
    id: 'dialogs',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v5.3',
    title: 'Finestre di conferma nello stile dell’app',
    description:
      'Sostituiti i popup nativi di Windows/browser con dialoghi coordinati ai temi per eliminazioni, verifiche, importazioni e altre operazioni.',
    icon: 'palette',
  },
  {
    id: 'clipboard-fixes',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v5.1–v5.2',
    title: 'Correzioni della gestione degli appunti',
    description: 'Risolte incompatibilità Rust emerse durante i test del componente clipboard-win.',
    icon: 'wrench',
  },
  {
    id: 'clipboard',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v5',
    title: 'Copia password senza finestre CMD',
    description:
      'Rimossi i processi PowerShell utilizzati per copiare e cancellare password dagli appunti Windows; aggiunti gli occhiolini nelle schede dei gruppi.',
    icon: 'key',
  },
  {
    id: 'theme-groups',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v4',
    title: 'Temi completi, loghi e gruppi di account',
    description:
      'Ripristinato il logo originale, introdotte palette complete e colori personalizzabili, gruppi per sito/app con loghi, rinominata «Accesso» in «Account» e migliorate le scrollbar.',
    icon: 'palette',
  },
  {
    id: 'recovery',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v3',
    title: 'Conferma codice di recupero corretta',
    description:
      'Corretto il pulsante di conferma del codice di recupero e impedita la chiusura involontaria della finestra prima della conferma.',
    icon: 'shield',
  },
  {
    id: 'compat-fixture',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v2',
    title: 'Test di compatibilità del vault legacy',
    description:
      'Corretto il percorso della fixture cifrata sintetica, usata per verificare la decifratura del formato Python originale.',
    icon: 'shield',
  },
  {
    id: 'rust-keys',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'v1',
    title: 'Correzioni alle chiavi crittografiche Rust',
    description:
      'Corrette incompatibilità di tipi e lifetime del porting Rust senza modificare il formato di cifratura esistente.',
    icon: 'shield',
  },
  {
    id: 'migration',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'Prima versione Tauri',
    title: 'Migrazione da Python a Rust e React',
    description:
      'Creato il nuovo progetto desktop Windows basato su Rust, Tauri 2, React e TypeScript, con il supporto al formato del vault originale.',
    icon: 'sparkles',
  },
  {
    id: 'legacy',
    addedAt: '2026-11-17T05:08:13+01:00',
    dateSource: 'git',
    version: 'Origini',
    title: 'Conservazione del progetto Python',
    description:
      'Mantenuta una copia dei sorgenti Python originali come riferimento per la migrazione, senza includere il vault personale nella repository.',
    icon: 'folder',
  },
];
