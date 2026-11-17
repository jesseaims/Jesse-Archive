#define AppVersion "1.1.8"
#define AppName "Jesse's Archive"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Jesse's Archive
OutputDir=..\src-tauri\target\release\bundle\distributable
OutputBaseFilename=JesseArchive-Setup
SetupIconFile=..\src-tauri\icon.ico
WizardStyle=modern
WizardImageFile=..\src-tauri\installer-assets\nsis-sidebar.bmp
WizardSmallImageFile=..\src-tauri\installer-assets\nsis-header.bmp
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
CreateAppDir=no
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
Uninstallable=no
CreateUninstallRegKey=no
ShowLanguageDialog=no
SetupLogging=yes

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; L'MSI contiene l'applicazione, le risorse e WebView2 offline.
; Non viene installato due volte e non rimane nella cartella programmi.
Source: "payload\JesseArchive.msi"; Flags: dontcopy noencryption

[Run]
Filename: "{code:GetInstalledApp}"; Parameters: "--browser-setup"; Description: "Configura le estensioni dei browser (collegamento automatico e caricamento guidato)"; Flags: postinstall nowait skipifsilent runasoriginaluser
; Must stay right after the browser entry: NextButtonClick refers to it as RunList item 1.
Filename: "{code:GetInstalledApp}"; Description: "Avvia {#AppName} al termine dell'installazione"; Flags: postinstall nowait skipifsilent runasoriginaluser

[Code]
var
  MsiNeedsRestart: Boolean;
  InstallDirPage: TInputDirWizardPage;

function GetInstalledApp(Param: String): String;
begin
  Result := AddBackslash(Trim(InstallDirPage.Values[0])) + 'jesse_archive.exe';
end;

procedure InitializeWizard();
begin
  { Inno acts as an MSI bootstrapper, not the app installer.
    Its normal directory page is not used (CreateAppDir=no).
    This page supplies INSTALLDIR to the Tauri/WiX MSI. }
  InstallDirPage := CreateInputDirPage(
    wpWelcome,
    'Cartella di installazione',
    'Dove desideri installare Jesse''s Archive?',
    'Seleziona la cartella in cui installare il programma. ' +
      'I dati del vault rimangono separati dalla cartella applicativa.',
    False, '');
  InstallDirPage.Add('');
  InstallDirPage.Values[0] := ExpandConstant('{autopf}\Jesse''s Archive');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ChosenPath: String;
begin
  Result := True;
  if CurPageID = InstallDirPage.ID then
  begin
    ChosenPath := Trim(InstallDirPage.Values[0]);
    if (ChosenPath = '') or (Pos('"', ChosenPath) > 0) then
    begin
      MsgBox('Seleziona un percorso valido, senza virgolette.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
  { Finish clicked: the postinstall entries run after this returns. When the browser
    guide is selected it already starts the app, and its "Ho installato l'estensione"
    button brings the main window up; launching a second instance at the same time
    would race the single-instance check, so the plain launch is skipped. }
  if (CurPageID = wpFinished) and (WizardForm.RunList.Items.Count >= 2) then
  begin
    if WizardForm.RunList.Checked[0] and WizardForm.RunList.Checked[1] then
    begin
      Log('Guida estensioni selezionata: avvio semplice saltato, la guida aprira'' l''app.');
      WizardForm.RunList.Checked[1] := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
  MsiFile: String;
  Params: String;
begin
  Result := '';
  MsiNeedsRestart := False;
  try
    ExtractTemporaryFile('JesseArchive.msi');
    MsiFile := ExpandConstant('{tmp}\JesseArchive.msi');
    Params := '/i "' + MsiFile + '" INSTALLDIR="' + Trim(InstallDirPage.Values[0]) + '" /passive /norestart';
    Log('Installazione tramite Windows Installer: ' + Params);

    if not Exec(ExpandConstant('{sys}\msiexec.exe'), Params, '', SW_SHOWNORMAL,
      ewWaitUntilTerminated, ExitCode) then
    begin
      Result := 'Impossibile avviare Windows Installer: ' + SysErrorMessage(ExitCode);
      Exit;
    end;

    Log('Codice di uscita MSI: ' + IntToStr(ExitCode));
    if ExitCode = 3010 then
      MsiNeedsRestart := True
    else if ExitCode <> 0 then
      Result := 'Installazione MSI non completata (codice ' + IntToStr(ExitCode) + '). ' +
        'Controlla i log di Windows Installer.';
  except
    Result := 'Impossibile estrarre o installare il pacchetto MSI: ' + GetExceptionMessage;
  end;
end;

function NeedRestart: Boolean;
begin
  Result := MsiNeedsRestart;
end;
