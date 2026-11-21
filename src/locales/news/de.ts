import type { NewsTranslations } from '../../news-changelog';

// German titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'extension-permissions': [
    'Erweiterung mit weniger Berechtigungen und Hinweisen zu Subdomains',
    'Die Browsererweiterung verlangt nicht mehr die Berechtigung, alle geöffneten Tabs zu lesen, die sie nicht brauchte: Der Hinweis auf den Browserverlauf bei der Installation entfällt, und Ausfüllen, Speichern von Konten und Passkeys funktionieren wie bisher. Im Mini-Fenster erscheinen Konten, die für die genaue Adresse der Seite gespeichert sind, zuerst; Konten für eine andere Subdomain derselben Website zeigen, wofür sie gespeichert sind (zum Beispiel „Gespeichert für accounts.google.com“), und wenn das Feld in einem Rahmen einer anderen Adresse liegt, weist das Mini-Fenster darauf hin.',
  ],
  'browser-channel-hardening': [
    'Besser geschützte Verbindung zum Browser',
    'Die Datei mit dem Zugangscode, mit dem sich die Erweiterung mit der App verbindet, kann jetzt nur noch dein Windows-Benutzer lesen, auch wenn der Ordner anderen das Lesen erlaubt, und sie wird beim Schließen der App gelöscht. Außerdem schließt die App Verbindungen, die sich nicht rechtzeitig ausweisen, überzählige Verbindungen und solche, die zu viele Nachrichten senden. Das Ausfüllen von Zugangsdaten funktioniert wie bisher und bleibt immer deine Entscheidung im Mini-Fenster.',
  ],
  'generator-checks': [
    'Genauerer Passwortgenerator und -check',
    'Der Generator erstellt keine trivialen PINs wie 000000 oder 123456 mehr, und die Option „Eindeutige Zeichen“ funktioniert auch bei Längen nahe der Anzahl verfügbarer Zeichen, wo sie vorher oft einen Fehler gab. Die geschätzten Bits generierter Passwörter sind jetzt eine vorsichtige Schätzung, die die gewählten Optionen berücksichtigt. Der Passwort-Gesundheitscheck erkennt auch gängige Passwörter mit kleinen Änderungen (wie „Password123!“, „p4ssw0rd“ oder ein Name mit Jahreszahl), Wiederholungen und Tastaturfolgen: Manche bisher als stark eingestufte Passwörter können nun als schwach erscheinen.',
  ],
  'password-bulk-select': [
    'Passwortarchiv leichter aufzuräumen',
    'Im Passwortarchiv wählt die Schaltfläche „Alle auswählen“ auf einmal alle angezeigten löschbaren Passwörter aus, auch wenn sie per Suche gefiltert sind, damit du den Verlauf bereinigen kannst, ohne jedes einzeln abzuhaken. Aktuelle Passwörter von Konten lassen sich nicht auswählen: Sie werden im Konto geändert. Nach dem Löschen zeigt die App an, wie viele Passwörter entfernt wurden. Außerdem werden beim endgültigen Löschen eines Elements (auch beim Leeren des Papierkorbs) seine Passwörter im Verlauf mitgelöscht, statt als nicht verknüpfte Passwörter zu bleiben.',
  ],
  'css-cleanup': [
    'Stylesheet bereinigt',
    'Aus dem Stil der Oberfläche wurden Regeln entfernt, die keine Wirkung mehr hatten: Eigenschaften, die immer von späteren Regeln überschrieben wurden, und der Stil eines Elements, das es nicht mehr gibt. Die App sieht genau gleich aus, und eine automatische Prüfung hat das Regel für Regel bestätigt.',
  ],
  'legacy-python-removed': [
    'Alte Python-Version aus dem Quellcode entfernt',
    'Die erste, in Python geschriebene Version von Jesse’s Archive ist nicht mehr Teil des Quellcodes: Die App nutzte sie nicht, und sie erschwerte die Wartung. Sie bleibt im Projektverlauf einsehbar. Mit dieser Version erstellte Tresore lassen sich weiterhin öffnen, und ein Test prüft das bei jeder Änderung. Für die Nutzung der App ändert sich nichts.',
  ],
  'export-keeps-groups': [
    'Exportierte Dateien behalten Gruppen und Favoriten',
    'Wenn du den Tresor als CSV exportierst und wieder importierst, kommen Konten von Apps und Diensten ohne Website (zum Beispiel mehrere Konten desselben Spiels) zurück in ihre benannte Gruppe, statt jeweils in einer eigenen Gruppe zu landen, und Favoriten bleiben Favoriten. Auch der JSON-Export behält jetzt Namen und Symbole der Gruppen. Außerdem verschwinden gelöschte und dann aus einer JSON-Datei erneut importierte Einträge beim nächsten Speichern nicht mehr.',
  ],
  'window-permissions': [
    'Jedes Fenster kann nur seine eigene Aufgabe erledigen',
    'Das Browser-Minifenster, die Schnellsuche und die Erweiterungsanleitung können jetzt nur noch die Funktionen nutzen, die sie jeweils brauchen: Sie können zum Beispiel den Tresor nicht mehr exportieren, keine Passwörter lesen, die sie nicht anzeigen, keine Einträge ändern und das Master-Passwort nicht ändern. All das ist weiterhin nur im Hauptfenster möglich. Im Alltag ändert sich nichts.',
  ],
  'group-favorites': [
    'Favoriten direkt in den Kontogruppen',
    'In der gruppierten Ansicht der Konten hat jedes Konto einen Stern, um es zu den Favoriten hinzuzufügen oder daraus zu entfernen, und der Stern neben dem Gruppennamen fügt alle Konten der Gruppe auf einmal hinzu oder entfernt sie, ohne sie einzeln zu öffnen.',
  ],
  'ui-secrets-on-demand': [
    'Passwörter bleiben nicht mehr im Hauptfenster geöffnet',
    'Das Hauptfenster erhält jetzt nur noch Namen, Benutzernamen und Adressen der Einträge. Passwörter, PINs, CVVs, Kartennummern, Seed-Phrasen, TOTP-Codes und der Text von Notizen bleiben in der vom Interface getrennten App-Engine, bis du sie anzeigst, kopierst oder den Eintrag zum Bearbeiten öffnest, und werden vergessen, wenn du den Eintrag schließt oder den Tresor sperrst. Aus den Kontokarten und dem Verlauf kopierte Passwörter gelangen direkt in die Zwischenablage, ohne durch das Fenster zu gehen. Die Suche findet weiterhin Wörter in Notizen.',
  ],
  'vault-scrypt-rollback': [
    'Master-Passwort schwerer zu knacken und Warnung vor alten Kopien',
    'Beim ersten Entsperren wechselt der Schutz des Master-Passworts zu einer viermal aufwendigeren Berechnung (scrypt mit 128 MB Speicher): Wer eine Kopie des Tresors erhält, braucht viel länger, um Passwörter auszuprobieren. Das Entsperren kann einen Sekundenbruchteil länger dauern. Neue .jshare-Pakete nutzen diesen Schutz ebenfalls. Wird die Tresordatei durch eine ältere Kopie ersetzt (zum Beispiel im Cloud-Ordner), erscheint beim Öffnen eine Warnung. Außerdem wird eine Änderung, die wegen einer belegten Datei nicht gespeichert wurde, jetzt bei der nächsten Synchronisierung gespeichert. Wenn du den Tresor auf mehreren PCs nutzt, aktualisiere alle: Nach dem ersten Entsperren mit dieser Version können ältere Versionen ihn nicht mehr öffnen.',
  ],
  'vault-header-key-rotation': [
    'Besserer Schutz beim Ändern des Master-Passworts',
    'Der Tresor-Header ist jetzt mit einem Schlüssel signiert, den nur du erhalten kannst: Eine alte Kopie im Tresorordner (etwa von jemandem mit Zugriff auf deine Cloud) kann kein altes Master-Passwort mehr zurückbringen. Beim Ändern des Master-Passworts kannst du „Das alte Passwort könnte bekannt geworden sein“ ankreuzen: Dann ändert sich auch der Schlüssel, der die Daten verschlüsselt, das alte Passwort öffnet den Tresor nicht mehr, auch nicht aus einer Kopie, und du erhältst einen neuen Wiederherstellungscode zum Speichern. Ein neuer Wiederherstellungscode ändert immer auch den Schlüssel. Wenn du den Tresor auf mehreren PCs nutzt, aktualisiere zuerst alle.',
  ],
  'universal-import': [
    'Import aus den wichtigsten Passwort-Managern',
    'Der Import erkennt jetzt die Dateien von Bitwarden (CSV und unverschlüsseltes JSON), LastPass, 1Password, Dashlane, NordPass, Proton Pass, KeePass und KeePassXC (CSV und XML), RoboForm sowie von Chrome, Edge, Brave, Opera, Firefox und Apple Passwörter. Vor dem Import zeigt eine Vorschau das erkannte Programm und die Anzahl der gefundenen Elemente; bei CSV-Dateien kannst du prüfen und ändern, welchem Feld jede Spalte zugeordnet wird – so funktionieren auch Dateien anderer Programme.',
  ],
  'bulk-select-accounts': [
    'Viele Konten auf einmal auswählen',
    'Unter „Alle Elemente“ und „Konten“ kannst du jetzt ganze Gruppen oder einzelne Konten mit ihrem Kästchen auswählen oder mit „Alle auswählen“ alles Sichtbare (auch Suchergebnisse) und sie auf einmal in den Papierkorb oder in einen Ordner verschieben.',
  ],
  'kaspersky-import': [
    'Import aus Kaspersky Password Manager',
    'Jesse’s Archive importiert jetzt die Textdatei (.txt), die Kaspersky Password Manager mit „In Textdatei exportieren“ erstellt: Websites, Anwendungen und andere Konten werden zu Konten mit Name, Adresse, Benutzername, Passwort und Kommentaren, Kaspersky-Notizen zu Notizen. Lösche die exportierte Datei danach: Sie enthält deine Passwörter im Klartext.',
  ],
  'unlock-throttling': [
    'Schutz gegen das Erraten des Passworts',
    'Nach 5 falschen Versuchen in Folge, den Tresor zu entsperren (Master-Passwort oder Wiederherstellungscode), lässt dich Jesse’s Archive 30 Sekunden bis zum nächsten Versuch warten, jedes Mal doppelt so lange bis zu 15 Minuten. Der Zähler bleibt auch nach einem Neustart der App erhalten und wird beim ersten richtigen Entsperren gelöscht.',
  ],
  'save-new-logins': [
    'Neue Konten direkt aus dem Browser speichern',
    'Wenn du dich auf einer Website registrierst oder mit einem Konto anmeldest, das noch nicht im Tresor ist, fragt Jesse’s Archive, ob es gespeichert werden soll: Name, Benutzername oder E-Mail, Passwort und auf Wunsch die übrigen eingegebenen Daten werden ein neues Konto für diese Website. Wenn du auf einer Website ein Passwort änderst, bietet es an, das gespeicherte zu aktualisieren. Ohne deine Bestätigung wird nichts gespeichert; in den Einstellungen kannst du die Funktion ausschalten oder Websites ausschließen. Erfordert die aktualisierte Erweiterung.',
  ],
  'installer-sharper-images': [
    'Schärfere Bilder im Installationsprogramm',
    'Logo und Name an der Seite des Setups sind jetzt scharf: Sie stammen aus der Originalgrafik und werden für jede Anzeigeskalierung in genau der passenden Größe erstellt, sodass Windows sie nicht mehr strecken muss.',
  ],
  'new-installer': [
    'Neues Installationsprogramm im Stil der App',
    'Das Setup wurde neu gestaltet: ein einziges Fenster vom Anfang bis zum Ende, mit dem dunklen Design und dem Logo von Jesse’s Archive, statt des Ablaufs über Windows Installer. Es hat jetzt auch eine eigene Deinstallation, die das Programm entfernt, ohne Tresor und Einstellungen anzutasten. Beim Update von der vorherigen Version musst du nichts tun: Das neue Setup ersetzt das alte im selben Ordner.',
  ],
  'extension-logo-autoreload': [
    'Erweiterungslogo und automatisches Neuladen',
    'Die Browsererweiterung zeigt jetzt das Logo von Jesse’s Archive in der Symbolleiste und in der Liste der Erweiterungen. Nach jedem Update lädt sie sich selbst neu, sobald sie sich mit der App verbindet, ohne dass du das auf der Erweiterungsseite von Hand tun musst. Lade sie dieses eine Mal noch von Hand neu: Das automatische Neuladen gilt ab den nächsten Updates.',
  ],
  'breach-check-autofill-fixes': [
    'Zuverlässigere Leak-Prüfung und Autofill',
    'Die Prüfung auf kompromittierte Konten funktioniert jetzt auch mit großen Tresoren (vorher brach sie ab etwa 120 Passwörtern mit „Pwned Passwords ist nicht erreichbar“ ab) und versucht es bei Netzwerkproblemen selbst erneut. Das Ausfüllen im Browser erkennt jetzt auch Anmeldefelder von Websites mit Webkomponenten wie Reddit sowie Anmelderahmen einer Subdomain derselben Website wie bei Ubisoft. Lade die Erweiterung nach dem Update auf der Erweiterungsseite des Browsers neu.',
  ],
  'global-quick-search': [
    'Globale Schnellsuche',
    'Drücken Sie Ctrl+Shift+Space in jeder Anwendung, auch wenn Jesse’s Archive im Infobereich ist, um ein kompaktes Suchfenster zu öffnen: Finden Sie Konten nach Name, Benutzername, E-Mail oder Website, mit den Konten desselben Dienstes gruppiert, und kopieren Sie Benutzername oder Passwort, zeigen Sie das Passwort einige Sekunden an, öffnen Sie die Website oder den Eintrag im Tresor – alles per Tastatur. Sie funktioniert nur bei entsperrtem Tresor, Passwörter werden kopiert, ohne durch das Fenster zu gehen, und die Zwischenablage wird wie gewohnt geleert. Tastenkürzel und Optionen finden Sie unter Einstellungen → Globale Schnellsuche.',
  ],
  'window-state': [
    'Das Fenster merkt sich Größe und Position',
    'Jesse’s Archive öffnet sich so, wie Sie es verlassen haben: im Vollbild, maximiert oder mit der gewählten Größe und Position, auch nach dem Umweg über den Infobereich. Ist der Bildschirm, auf dem es lag, nicht mehr angeschlossen, öffnet sich das Fenster in der Mitte des verfügbaren.',
  ],
  'customizable-dashboard': [
    'Anpassbares Dashboard',
    'Das neue Dashboard ist das Kontrollzentrum der App: Sicherheitswert, Passwortanalyse, Tresor-Übersicht, Favoriten, letzte Elemente, sichere Notizen, Schnellaktionen, Generator, Sicherungsstatus und Datenschutz. Mit „Dashboard anpassen“ fügst du Widgets hinzu, entfernst, verschiebst und vergrößerst sie, wählst zwischen mehreren Layouts und stellst die Optionen jedes Widgets ein; alles wird automatisch im verschlüsselten Tresor gespeichert, und kein Widget zeigt Passwörter an.',
  ],
  multilanguage: [
    'Jesse’s Archive spricht deine Sprache',
    'Mit der neuen Schaltfläche „Sprache“ oben rechts wählst du zwischen Italienisch, Englisch, Spanisch, Französisch, Deutsch, Portugiesisch, Russisch, Chinesisch, Japanisch und Koreanisch. Die ganze App wechselt sofort, auch der Entsperrbildschirm, das Browser-Minifenster und das Menü im Infobereich; beim ersten Start wird die Sprache von Windows verwendet. Auch das Installationsprogramm und die Browsererweiterung folgen der Systemsprache.',
  ],
  'installer-logo': [
    'Logo im Installationsprogramm korrigiert',
    'Bei der Installation erscheint das Logo oben rechts nicht mehr gestaucht: Es ist jetzt das App-Logo, scharf und richtig proportioniert, auch bei vergrößerter Anzeige.',
  ],
  'webauthn-passkeys': [
    'Passkeys auf Websites',
    'Wenn eine Website einen Passkey anbietet, öffnet Jesse’s Archive das Minifenster: Du kannst ihn im verschlüsselten Tresor speichern und zum Anmelden verwenden oder „Anderes Gerät verwenden“ für dein Telefon oder Windows Hello wählen. Jede Verwendung erfordert deine Bestätigung. Lade die Erweiterung nach dem Update im Browser neu; Firefox benötigt Version 128 oder neuer. Abschaltbar unter Einstellungen → Desktop.',
  ],
  'auto-update': [
    'Automatische Updates',
    'Die App sucht beim Start und einmal täglich nach neuen Versionen und fragt, ob sie installiert werden sollen: „Jetzt aktualisieren“ lädt das Installationsprogramm herunter, prüft die digitale Signatur des Autors und öffnet die App aktualisiert wieder. Unter Einstellungen → Updates kannst du manuell suchen oder die automatische Prüfung abschalten.',
  ],
  'zoom-typed-min-max': [
    'Zoom nach Wahl, Minimum und Maximum',
    'Unter Einstellungen → Darstellung kannst du den gewünschten Zoom in Prozent eingeben (50 bis 200) und mit zwei neuen Schaltflächen direkt zum minimalen oder maximalen Zoom springen.',
  ],
  'interface-zoom': [
    'Zoom der Oberfläche',
    'Vergrößere oder verkleinere die App mit Strg + + und Strg + − (oder Strg + F12 / Strg + F11 oder Strg + Mausrad) und kehre mit Strg + 0 zu 100 % zurück. Du findest es auch unter Einstellungen → Darstellung: Es gilt für alle Fenster und wird auf diesem PC gespeichert.',
  ],
  'empty-trash': [
    'Papierkorb leeren',
    'Auf der Seite Papierkorb löscht die Schaltfläche „Papierkorb leeren“ alle Elemente auf einmal endgültig, nach zwei Bestätigungen, die zeigen, was gelöscht wird.',
  ],
  'settings-layout-installer-flow': [
    'Kompaktere Einstellungen und bequemere Installation',
    'Die Bereiche der Einstellungen ordnen sich ohne Lücken an. Die Installation bietet ein Häkchen, um die App am Ende zu starten, und der Erweiterungsassistent hat die Schaltfläche „Ich habe die Erweiterung installiert“, die ihn schließt und Jesse’s Archive öffnet.',
  ],
  'refresh-feedback-appearance': [
    'Schaltfläche Aktualisieren mit Ergebnis und neuer Bereich Darstellung',
    'Die Schaltfläche Aktualisieren zeigt, was sie getan hat: ob sie neue, geänderte oder entfernte Elemente gefunden hat oder ob schon alles aktuell war, und bei Problemen erklärt sie, was schiefgelaufen ist. Themes und Farben der App haben jetzt einen eigenen Bereich, Darstellung, in den Einstellungen.',
  ],
  'regroup-on-site-change': [
    'Die Website eines Kontos wird beim Ändern aktualisiert',
    'Wenn du die Website eines Kontos änderst, erscheint es in der Sammlung sofort unter der neuen Website, statt unter der ursprünglich eingegebenen zu bleiben. Früher gespeicherte Einträge werden ebenfalls automatisch korrigiert.',
  ],
  'delete-accounts-and-groups': [
    'Löschen von Konten, Gruppen und Elementen',
    'Jede Kontogruppe hat die Schaltfläche „Konto löschen“ für ein einzelnes Konto und einen Papierkorb zum Löschen der ganzen Gruppe, mit doppelter Bestätigung, die auflistet, was gelöscht wird. Auch Elemente der anderen Kategorien lassen sich mit einem Klick und einer Bestätigung löschen. Alles landet im Papierkorb und kann von dort wiederhergestellt werden.',
  ],
  'session-hardening': [
    'Zuverlässigere automatische Sperre und sicherere Importe',
    'Der Tresor sperrt sich wirklich nach der gewählten Inaktivitätszeit, auch bei ausgeblendetem Fenster, und der Bildschirm wird geleert. Tastatur, Klicks und Scrollen zählen als Aktivität. Eine Importdatei mit auch nur einem ungültigen Element wird abgelehnt, ohne den Tresor zu verändern, und die Mindestlänge von Passwörtern zählt Buchstaben mit Akzent jetzt korrekt.',
  ],
  'news-entry-timestamps': [
    'Datum und Uhrzeit für jede Neuigkeit und jeden Commit',
    'Jeder Eintrag in den Bereichen Neuigkeiten und Commits zeigt unten rechts sein eigenes Datum und seine Uhrzeit in gut lesbarer Schrift. Die Zeiten bleiben von Build zu Build gleich.',
  ],
  'browser-site-matching': [
    'Konten über Domain und Subdomains hinweg erkannt',
    'Ohne Protokoll gespeicherte Adressen werden erkannt, und Konten werden auch auf den Anmeldeseiten von Subdomains derselben Website angeboten, etwa im Epic Games Store. Der Vergleich unterscheidet fremde Domains und Dienste mit unabhängigen Subdomains.',
  ],
  'browser-extension-navigation': [
    'Erweiterungsseite öffnet sich korrekt',
    'Der Assistent öffnet ein neues Fenster des gewählten Browsers und erreicht dessen Erweiterungsseite über die Adressleiste. Eine kopierbare Adresse und eine Schaltfläche für einen neuen Versuch wurden hinzugefügt.',
  ],
  'browser-setup-wizard': [
    'Geführte Browser-Einrichtung',
    'Das Installationsprogramm öffnet einen Assistenten, der die Browser erkennt, die lokale Verbindung automatisch registriert und Seite und Ordner zum Laden der Erweiterung öffnet. Auch in den Einstellungen verfügbar.',
  ],
  'browser-quick-fill': [
    'Schnelles Ausfüllen in Browsern',
    'Anpassbares globales Tastenkürzel, Entsperren in einem Minifenster und Auswahl der Konten für die aktuelle HTTPS-Domain über die Erweiterung für Chromium oder Firefox. Die Felder werden ausgefüllt, ohne die Anmeldung abzuschicken.',
  ],
  'news-dialog': [
    'Neuigkeiten und Commit-Verlauf in JesseArchive',
    'Neue Schaltfläche Neuigkeiten neben „Lokal geschützt“: zwei Bereiche, Neuigkeiten und Commits, mit Suche, Revisionsdetails und offline durchsuchbarem Git-Verlauf.',
  ],
  'git-ready': [
    'Git-Verlauf und GitHub-Repository',
    'Das Repository wurde mit dem rekonstruierten Projektverlauf, den Commit-Nachrichten, Regeln zum Ausschließen von Tresoren und sensiblen Dateien sowie Werkzeugen zum Veröffentlichen der Quellen vorbereitet.',
  ],
  'generator-button': [
    'Größere Schaltfläche Generieren',
    'Die Hauptschaltfläche des Passwortgenerators ist größer, mit besser lesbarem Text und größerer Klickfläche auch in kleinen Fenstern.',
  ],
  'beta-label': [
    'Beta-Phase gekennzeichnet',
    'In den Einstellungen wurde die Angabe „Version: Beta“ hinzugefügt, mit der Nummer aus der App-Version.',
  ],
  'version-file': [
    'Sichtbare Version und einfacher Name des Installationsprogramms',
    'Die Versionsnummer erscheint jetzt in den Einstellungen, und der Name des Installationsprogramms wurde zu JesseArchive-Setup.exe vereinfacht.',
  ],
  'installer-images': [
    'Grafik des Installationsprogramms korrigiert',
    'Das Original-Logo von JesseArchive wird in Seitenleiste und Kopfzeile des Installationsprogramms verwendet, mit den richtigen Proportionen.',
  ],
  'installer-folder': [
    'Wählbarer Installationsordner',
    'Das Setup hat einen Bildschirm, um den Installationspfad zu wählen und an das MSI-Paket zu übergeben.',
  ],
  'category-create': [
    'Neue Elemente in der richtigen Kategorie',
    'In Konten, Passkeys, Notizen, Karten, Identitäten und Krypto wählt der Editor den Elementtyp automatisch; in den allgemeinen Ansichten bleibt er änderbar.',
  ],
  'inno-exe': [
    'EXE-Installationsprogramm mit Inno Setup',
    'Verteilung über ein einziges Setup-EXE, das das Tauri-MSI enthält, wodurch das in den Builds aufgetretene Problem mit NSIS-Makros vermieden wird.',
  ],
  offline: [
    'Windows-Installation auch offline',
    'Das MSI-Paket enthält WebView2 offline, sodass andere PCs weder Node.js noch Rust noch eine Verbindung zum Herunterladen der Laufzeit brauchen.',
  ],
  'msi-brand': [
    'Angepasstes MSI-Installationsprogramm',
    'Eigene Bilder für die Bildschirme des MSI-Assistenten, unter Beibehaltung des Original-Logos der App.',
  ],
  cloud: [
    'Bessere Suche nach lokalen Cloud-Ordnern',
    'Die Erkennung von Ordnern von OneDrive, Dropbox und anderen Anbietern wurde erweitert, mit klaren Meldungen, wenn die Suche nichts findet.',
  ],
  history: [
    'Wiederherstellung aus dem Verlauf verständlicher',
    'Die unklare Auswahl wurde durch „Für Konto verwenden“ ersetzt: Du wählst ein archiviertes Passwort und bestätigst, welches lokale Konto aktualisiert wird. Die Instagram-Signatur des Entwicklers wurde hinzugefügt.',
  ],
  dialogs: [
    'Bestätigungsfenster im Stil der App',
    'Die nativen Popups von Windows und Browser wurden durch zu den Themes passende Dialoge für Löschen, Prüfungen, Importe und weitere Vorgänge ersetzt.',
  ],
  'clipboard-fixes': [
    'Korrekturen bei der Zwischenablage',
    'Rust-Inkompatibilitäten, die bei den Tests der Komponente clipboard-win auftraten, wurden behoben.',
  ],
  clipboard: [
    'Passwörter ohne CMD-Fenster kopieren',
    'Die PowerShell-Prozesse zum Kopieren und Löschen von Passwörtern in der Windows-Zwischenablage wurden entfernt; die Augensymbole wurden zu den Gruppenkarten hinzugefügt.',
  ],
  'theme-groups': [
    'Vollständige Themes, Logos und Kontogruppen',
    'Das Original-Logo wurde wiederhergestellt, vollständige Paletten und eigene Farben, Gruppen nach Website/App mit Logos eingeführt, „Accesso“ in „Konto“ umbenannt und die Bildlaufleisten verbessert.',
  ],
  recovery: [
    'Bestätigung des Wiederherstellungscodes korrigiert',
    'Die Schaltfläche zur Bestätigung des Wiederherstellungscodes wurde korrigiert, und das Fenster kann sich vor der Bestätigung nicht mehr versehentlich schließen.',
  ],
  'compat-fixture': [
    'Kompatibilitätstest für den alten Tresor',
    'Der Pfad der synthetischen verschlüsselten Testdatei, mit der die Entschlüsselung des ursprünglichen Python-Formats geprüft wird, wurde korrigiert.',
  ],
  'rust-keys': [
    'Korrekturen an den kryptografischen Schlüsseln in Rust',
    'Typ- und Lifetime-Inkompatibilitäten der Rust-Portierung wurden behoben, ohne das bestehende Verschlüsselungsformat zu ändern.',
  ],
  migration: [
    'Migration von Python zu Rust und React',
    'Das neue Windows-Desktop-Projekt auf Basis von Rust, Tauri 2, React und TypeScript wurde erstellt, mit Unterstützung für das ursprüngliche Tresorformat.',
  ],
  legacy: [
    'Python-Projekt aufbewahrt',
    'Eine Kopie der ursprünglichen Python-Quellen wurde als Referenz für die Migration aufbewahrt, ohne den persönlichen Tresor ins Repository aufzunehmen.',
  ],
};

export default news;
