#define AppVersion "1.1.17"
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
; Square logo for the top-right corner, one bitmap per DPI scale (100%..250%):
; Inno picks the closest size, so the image is never squeezed out of shape.
WizardSmallImageFile=..\src-tauri\installer-assets\inno-small-55x55.bmp,..\src-tauri\installer-assets\inno-small-64x68.bmp,..\src-tauri\installer-assets\inno-small-69x69.bmp,..\src-tauri\installer-assets\inno-small-83x80.bmp,..\src-tauri\installer-assets\inno-small-92x97.bmp,..\src-tauri\installer-assets\inno-small-110x106.bmp,..\src-tauri\installer-assets\inno-small-119x123.bmp,..\src-tauri\installer-assets\inno-small-138x140.bmp
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
; Setup picks the Windows display language (Italian when it is not listed).
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[CustomMessages]
italian.DirCaption=Cartella di installazione
italian.DirQuestion=Dove desideri installare Jesse's Archive?
italian.DirDescription=Seleziona la cartella in cui installare il programma. I dati del vault rimangono separati dalla cartella applicativa.
italian.InvalidPath=Seleziona un percorso valido, senza virgolette.
italian.RunBrowserSetup=Configura le estensioni dei browser (collegamento automatico e caricamento guidato)
italian.RunLaunchApp=Avvia %1 al termine dell'installazione
italian.MsiStartFailed=Impossibile avviare Windows Installer: %1
italian.MsiFailed=Installazione MSI non completata (codice %1). Controlla i log di Windows Installer.
italian.MsiExtractFailed=Impossibile estrarre o installare il pacchetto MSI: %1

english.DirCaption=Installation folder
english.DirQuestion=Where do you want to install Jesse's Archive?
english.DirDescription=Select the folder where the program will be installed. The vault data stays separate from the program folder.
english.InvalidPath=Select a valid path, without quotation marks.
english.RunBrowserSetup=Set up the browser extensions (automatic connection and guided loading)
english.RunLaunchApp=Start %1 when the installation finishes
english.MsiStartFailed=Cannot start Windows Installer: %1
english.MsiFailed=The MSI installation did not complete (code %1). Check the Windows Installer logs.
english.MsiExtractFailed=Cannot extract or install the MSI package: %1

spanish.DirCaption=Carpeta de instalación
spanish.DirQuestion=¿Dónde quieres instalar Jesse's Archive?
spanish.DirDescription=Selecciona la carpeta donde se instalará el programa. Los datos de la bóveda se guardan aparte de la carpeta del programa.
spanish.InvalidPath=Selecciona una ruta válida, sin comillas.
spanish.RunBrowserSetup=Configurar las extensiones del navegador (conexión automática y carga guiada)
spanish.RunLaunchApp=Iniciar %1 al terminar la instalación
spanish.MsiStartFailed=No se puede iniciar Windows Installer: %1
spanish.MsiFailed=La instalación MSI no se completó (código %1). Revisa los registros de Windows Installer.
spanish.MsiExtractFailed=No se puede extraer o instalar el paquete MSI: %1

french.DirCaption=Dossier d'installation
french.DirQuestion=Où voulez-vous installer Jesse's Archive ?
french.DirDescription=Sélectionnez le dossier où installer le programme. Les données du coffre restent séparées du dossier du programme.
french.InvalidPath=Sélectionnez un chemin valide, sans guillemets.
french.RunBrowserSetup=Configurer les extensions des navigateurs (connexion automatique et chargement guidé)
french.RunLaunchApp=Lancer %1 à la fin de l'installation
french.MsiStartFailed=Impossible de lancer Windows Installer : %1
french.MsiFailed=L'installation MSI n'est pas terminée (code %1). Consultez les journaux de Windows Installer.
french.MsiExtractFailed=Impossible d'extraire ou d'installer le paquet MSI : %1

german.DirCaption=Installationsordner
german.DirQuestion=Wo soll Jesse's Archive installiert werden?
german.DirDescription=Wähle den Ordner, in dem das Programm installiert wird. Die Tresordaten bleiben vom Programmordner getrennt.
german.InvalidPath=Wähle einen gültigen Pfad ohne Anführungszeichen.
german.RunBrowserSetup=Browser-Erweiterungen einrichten (automatische Verbindung und geführtes Laden)
german.RunLaunchApp=%1 nach der Installation starten
german.MsiStartFailed=Windows Installer kann nicht gestartet werden: %1
german.MsiFailed=Die MSI-Installation wurde nicht abgeschlossen (Code %1). Prüfe die Protokolle von Windows Installer.
german.MsiExtractFailed=Das MSI-Paket kann nicht entpackt oder installiert werden: %1

brazilianportuguese.DirCaption=Pasta de instalação
brazilianportuguese.DirQuestion=Onde você quer instalar o Jesse's Archive?
brazilianportuguese.DirDescription=Selecione a pasta onde o programa será instalado. Os dados do cofre ficam separados da pasta do programa.
brazilianportuguese.InvalidPath=Selecione um caminho válido, sem aspas.
brazilianportuguese.RunBrowserSetup=Configurar as extensões dos navegadores (conexão automática e carregamento guiado)
brazilianportuguese.RunLaunchApp=Iniciar o %1 ao final da instalação
brazilianportuguese.MsiStartFailed=Não foi possível iniciar o Windows Installer: %1
brazilianportuguese.MsiFailed=A instalação MSI não foi concluída (código %1). Verifique os logs do Windows Installer.
brazilianportuguese.MsiExtractFailed=Não foi possível extrair ou instalar o pacote MSI: %1

russian.DirCaption=Папка установки
russian.DirQuestion=Куда установить Jesse's Archive?
russian.DirDescription=Выберите папку для установки программы. Данные хранилища хранятся отдельно от папки программы.
russian.InvalidPath=Выберите допустимый путь без кавычек.
russian.RunBrowserSetup=Настроить расширения браузеров (автоматическое подключение и пошаговая загрузка)
russian.RunLaunchApp=Запустить %1 после завершения установки
russian.MsiStartFailed=Не удалось запустить установщик Windows: %1
russian.MsiFailed=Установка MSI не завершена (код %1). Проверьте журналы установщика Windows.
russian.MsiExtractFailed=Не удалось извлечь или установить пакет MSI: %1

chinesesimplified.DirCaption=安装文件夹
chinesesimplified.DirQuestion=你想把 Jesse's Archive 安装在哪里？
chinesesimplified.DirDescription=请选择安装程序的文件夹。保险库数据与程序文件夹分开保存。
chinesesimplified.InvalidPath=请选择有效路径，不要包含引号。
chinesesimplified.RunBrowserSetup=设置浏览器扩展（自动连接和引导加载）
chinesesimplified.RunLaunchApp=安装完成后启动 %1
chinesesimplified.MsiStartFailed=无法启动 Windows Installer：%1
chinesesimplified.MsiFailed=MSI 安装未完成（代码 %1）。请查看 Windows Installer 日志。
chinesesimplified.MsiExtractFailed=无法解压或安装 MSI 包：%1

japanese.DirCaption=インストール先フォルダー
japanese.DirQuestion=Jesse's Archive をどこにインストールしますか?
japanese.DirDescription=プログラムをインストールするフォルダーを選択してください。保管庫のデータはプログラム フォルダーとは別に保存されます。
japanese.InvalidPath=引用符を含まない有効なパスを選択してください。
japanese.RunBrowserSetup=ブラウザー拡張機能を設定する (自動接続とガイド付きの読み込み)
japanese.RunLaunchApp=インストール完了後に %1 を起動する
japanese.MsiStartFailed=Windows インストーラーを起動できません: %1
japanese.MsiFailed=MSI のインストールが完了しませんでした (コード %1)。Windows インストーラーのログを確認してください。
japanese.MsiExtractFailed=MSI パッケージを展開またはインストールできません: %1

korean.DirCaption=설치 폴더
korean.DirQuestion=Jesse's Archive를 어디에 설치할까요?
korean.DirDescription=프로그램을 설치할 폴더를 선택하세요. 보관함 데이터는 프로그램 폴더와 별도로 저장됩니다.
korean.InvalidPath=따옴표가 없는 유효한 경로를 선택하세요.
korean.RunBrowserSetup=브라우저 확장 프로그램 설정(자동 연결 및 안내형 로드)
korean.RunLaunchApp=설치가 끝나면 %1 실행
korean.MsiStartFailed=Windows Installer를 시작할 수 없습니다: %1
korean.MsiFailed=MSI 설치가 완료되지 않았습니다(코드 %1). Windows Installer 로그를 확인하세요.
korean.MsiExtractFailed=MSI 패키지를 추출하거나 설치할 수 없습니다: %1

[Files]
; L'MSI contiene l'applicazione, le risorse e WebView2 offline.
; Non viene installato due volte e non rimane nella cartella programmi.
Source: "payload\JesseArchive.msi"; Flags: dontcopy noencryption

[Run]
Filename: "{code:GetInstalledApp}"; Parameters: "--browser-setup"; Description: "{cm:RunBrowserSetup}"; Flags: postinstall nowait skipifsilent runasoriginaluser
; Must stay right after the browser entry: NextButtonClick refers to it as RunList item 1.
Filename: "{code:GetInstalledApp}"; Description: "{cm:RunLaunchApp,{#AppName}}"; Flags: postinstall nowait skipifsilent runasoriginaluser
; Automatic update (/SILENT from the app): reopen the app once the MSI has finished.
; Not a postinstall entry, so it is not part of the RunList above.
Filename: "{code:GetInstalledApp}"; Flags: nowait runasoriginaluser; Check: WizardSilent

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
    CustomMessage('DirCaption'),
    CustomMessage('DirQuestion'),
    CustomMessage('DirDescription'),
    False, '');
  InstallDirPage.Add('');
  { The automatic updater passes /INSTALLDIR="<current program folder>" so a silent
    update replaces the existing installation instead of the default folder. }
  InstallDirPage.Values[0] := Trim(ExpandConstant('{param:INSTALLDIR|}'));
  if (InstallDirPage.Values[0] = '') or (Pos('"', InstallDirPage.Values[0]) > 0) then
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
      MsgBox(CustomMessage('InvalidPath'), mbError, MB_OK);
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
      Result := FmtMessage(CustomMessage('MsiStartFailed'), [SysErrorMessage(ExitCode)]);
      Exit;
    end;

    Log('Codice di uscita MSI: ' + IntToStr(ExitCode));
    if ExitCode = 3010 then
      MsiNeedsRestart := True
    else if ExitCode <> 0 then
      Result := FmtMessage(CustomMessage('MsiFailed'), [IntToStr(ExitCode)]);
  except
    Result := FmtMessage(CustomMessage('MsiExtractFailed'), [GetExceptionMessage]);
  end;
end;

function NeedRestart: Boolean;
begin
  Result := MsiNeedsRestart;
end;
