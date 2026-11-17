# Jesse's Archive — revisione UI v4

Questa revisione deriva dalla versione **Corretto-v3** e mantiene il formato `.vault` v1. Nessun vault reale è incluso.

## Modifiche implementate

1. **Logo originale:** l'icona ICO del progetto Python originale è stata ripristinata come icona Tauri/Windows e favicon, e convertita in PNG per schermata di avvio e sidebar. Windows può conservare temporaneamente una vecchia icona nella cache di Explorer.
2. **Temi completi:** otto preset con palette effettivamente diverse (sfondo, sidebar, pannelli, campi, bordi, testo) e editor personalizzato di 14 colori; le preferenze rimangono nella configurazione cifrata del vault.
3. **Account:** la categoria visualizzata come «Accesso» è rinominata in «Account»; il tipo interno `login` è volutamente invariato per preservare la compatibilità.
4. **Raggruppamento:** le schede dei siti/app raggruppano le credenziali e offrono navigazione precedente/successivo, copia e apertura. Gli elementi v1 senza gruppo vengono raggruppati in visualizzazione senza migrazione distruttiva. L'editor richiede la categoria di origine sito/email, app o altro. Le favicon dei nuovi siti vengono richieste solo con opzione loghi abilitata e se esiste la rete; le app installate possono fornire la propria icona; «Altro» e app supportano immagini locali PNG/JPEG/WEBP/ICO (massimo 150 KB). Le immagini sono salvate nel vault cifrato, non in cartelle temporanee.
5. **Doppio occhio password:** eliminato il controllo nativo Microsoft Edge sul campo password, mantenendo il pulsante personalizzato.
6. **Storico:** descritta l'associazione di una password a un account e aggiunta la conferma preventiva dell'operazione che cambia la password attiva conservando lo storico.
7. **Scrollbar:** scrollbar sottili, arrotondate e adattate ai colori del tema.

## Build Windows

Nella cartella del progetto:

```powershell
npm install
cargo test --manifest-path .\src-tauri\Cargo.toml
npm run tauri -- build --bundles msi
```

Chiudere prima ogni processo `jesse_archive.exe`. Se il comando `tauri` manca, reinstallare le dipendenze con `npm install`.

## Stato di verifica

- File ZIP, icona originale, JSON, import e sintassi TS/TSX controllati staticamente.
- Non è stato possibile eseguire in questo ambiente test Rust/Cargo né build frontend con le dipendenze npm installate: i test effettivi e la build Windows devono essere eseguiti su Windows.
- Non usare password personali fino a verifica di apertura/salvataggio/riapertura, storico, recupero e backup su vault sintetici.
