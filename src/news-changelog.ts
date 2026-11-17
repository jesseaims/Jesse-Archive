/** Curated user-facing changelog. Add an entry when publishing a new update.
 * These are development milestones, not independent security audit claims. */
export type NewsEntry = {
  id:string;
  version:string;
  title:string;
  description:string;
  icon:'sparkles'|'shield'|'palette'|'folder'|'package'|'wrench'|'key'|'cloud';
};

export const NEWS_ENTRIES:NewsEntry[] = [
  {id:'news-dialog',version:'Beta 1.0.3',title:'Novità e cronologia commit dentro JesseArchive',description:'Aggiunto il pulsante News accanto a «Protetto localmente»: due schede, Novità e Commit, con ricerca, dettagli delle revisioni e cronologia Git consultabile offline.',icon:'sparkles'},
  {id:'git-ready',version:'Beta 1.0.2',title:'Cronologia Git e repository GitHub',description:'Preparata la repository con la storia ricostruita del progetto, i messaggi di commit, le regole per escludere vault e file sensibili e gli strumenti per pubblicare i sorgenti.',icon:'wrench'},
  {id:'generator-button',version:'Beta 1.0.2',title:'Pulsante Genera più grande',description:'Ingrandito il pulsante principale del generatore di password, con testo e area di clic più leggibili anche su finestre ridotte.',icon:'sparkles'},
  {id:'beta-label',version:'Beta 1.0.2',title:'Identificata la fase Beta',description:'Aggiunta nelle Impostazioni la dicitura «Version: Beta», con il numero letto dalla versione dell’app.',icon:'wrench'},
  {id:'version-file',version:'1.0.2',title:'Versione visibile e setup dal nome semplice',description:'Aggiunto il numero di versione nelle Impostazioni e semplificato il nome dell’installer in JesseArchive-Setup.exe.',icon:'package'},
  {id:'installer-images',version:'1.0.2',title:'Grafica dell’installer corretta',description:'Usato il logo originale di JesseArchive nella barra laterale e nella testata dell’installer, mantenendone le proporzioni.',icon:'palette'},
  {id:'installer-folder',version:'1.0.2',title:'Cartella di installazione selezionabile',description:'Aggiunta al setup una schermata per scegliere il percorso di installazione e passarlo al pacchetto MSI.',icon:'folder'},
  {id:'category-create',version:'1.0.2',title:'Nuovi elementi nella categoria giusta',description:'Da Account, Passkey, Note, Carte, Identità e Crypto l’editor seleziona automaticamente il tipo dell’elemento; dalle viste generali resta modificabile.',icon:'sparkles'},
  {id:'inno-exe',version:'1.0.2',title:'Installer EXE con Inno Setup',description:'Aggiunta la distribuzione tramite un singolo setup EXE che contiene l’MSI Tauri, evitando il problema delle macro NSIS riscontrato nelle build.',icon:'package'},
  {id:'offline',version:'1.0.2',title:'Installazione Windows anche offline',description:'Configurato il pacchetto MSI per includere WebView2 offline, così gli altri PC non devono avere Node.js, Rust o una connessione per scaricare il runtime.',icon:'package'},
  {id:'msi-brand',version:'v5.5',title:'Installer MSI personalizzato',description:'Inserite immagini personalizzate per le schermate del wizard MSI e mantenuto il logo originale dell’app.',icon:'palette'},
  {id:'cloud',version:'v5.5',title:'Ricerca delle cartelle cloud locali migliorata',description:'Ampliato il rilevamento delle cartelle OneDrive, Dropbox e altri provider e aggiunti messaggi espliciti quando la ricerca non trova risultati.',icon:'cloud'},
  {id:'history',version:'v5.4',title:'Recupero dallo storico reso comprensibile',description:'Sostituito il selettore poco chiaro con «Usa per account»: scegli una password archiviata e confermi quale account locale aggiornare. Aggiunta la firma Instagram dello sviluppatore.',icon:'key'},
  {id:'dialogs',version:'v5.3',title:'Finestre di conferma nello stile dell’app',description:'Sostituiti i popup nativi di Windows/browser con dialoghi coordinati ai temi per eliminazioni, verifiche, importazioni e altre operazioni.',icon:'palette'},
  {id:'clipboard-fixes',version:'v5.1–v5.2',title:'Correzioni della gestione degli appunti',description:'Risolte incompatibilità Rust emerse durante i test del componente clipboard-win.',icon:'wrench'},
  {id:'clipboard',version:'v5',title:'Copia password senza finestre CMD',description:'Rimossi i processi PowerShell utilizzati per copiare e cancellare password dagli appunti Windows; aggiunti gli occhiolini nelle schede dei gruppi.',icon:'key'},
  {id:'theme-groups',version:'v4',title:'Temi completi, loghi e gruppi di account',description:'Ripristinato il logo originale, introdotte palette complete e colori personalizzabili, gruppi per sito/app con loghi, rinominata «Accesso» in «Account» e migliorate le scrollbar.',icon:'palette'},
  {id:'recovery',version:'v3',title:'Conferma codice di recupero corretta',description:'Corretto il pulsante di conferma del codice di recupero e impedita la chiusura involontaria della finestra prima della conferma.',icon:'shield'},
  {id:'compat-fixture',version:'v2',title:'Test di compatibilità del vault legacy',description:'Corretto il percorso della fixture cifrata sintetica, usata per verificare la decifratura del formato Python originale.',icon:'shield'},
  {id:'rust-keys',version:'v1',title:'Correzioni alle chiavi crittografiche Rust',description:'Corrette incompatibilità di tipi e lifetime del porting Rust senza modificare il formato di cifratura esistente.',icon:'shield'},
  {id:'migration',version:'Prima versione Tauri',title:'Migrazione da Python a Rust e React',description:'Creato il nuovo progetto desktop Windows basato su Rust, Tauri 2, React e TypeScript, con il supporto al formato del vault originale.',icon:'sparkles'},
  {id:'legacy',version:'Origini',title:'Conservazione del progetto Python',description:'Mantenuta una copia dei sorgenti Python originali come riferimento per la migrazione, senza includere il vault personale nella repository.',icon:'folder'},
];
