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

export const NEWS_ENTRIES: NewsEntry[] = [
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
