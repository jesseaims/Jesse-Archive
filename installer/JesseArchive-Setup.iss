#define AppVersion "1.3.0"
#define AppName "Jesse's Archive"
#define AppExe "jesse_archive.exe"
; Fixed id of this installation: updates and uninstall rely on it, never change it.
#define AppGuid "1B73EBC5-AB0E-4D0D-B7AD-8DCA2AC010D5"
; UpgradeCode of the Tauri/WiX MSI used up to Beta 1.1.21 (identifier app.jesse.archive).
#define MsiUpgradeCode "5f0adf7a-68ec-53cf-8216-229940fbbec8"

[Setup]
AppId={{{#AppGuid}}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Jesse's Archive
AppPublisherURL=https://github.com/jesseaims/Jesse-Archive
AppSupportURL=https://github.com/jesseaims/Jesse-Archive/issues
VersionInfoVersion={#AppVersion}
OutputDir=..\src-tauri\target\release\bundle\distributable
OutputBaseFilename=JesseArchive-Setup
SetupIconFile=..\src-tauri\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
; Look of the app's default "Notte" theme. Images: scripts/installer-art.ps1.
WizardStyle=modern dark hidebevels includetitlebar
WizardBackColor=#0d0e16
; One image per DPI setting (100% to 250%), at the exact size of its area: never resampled.
WizardBackImageFile=art\background-596.png,art\background-796.png,art\background-994.png,art\background-1193.png,art\background-1272.png,art\background-1471.png,art\background-1630.png
WizardImageFile=art\side-202.png,art\side-269.png,art\side-336.png,art\side-403.png,art\side-430.png,art\side-498.png,art\side-534.png
WizardSmallImageFile=art\small-58.png,art\small-77.png,art\small-97.png,art\small-116.png,art\small-124.png,art\small-143.png,art\small-159.png
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DefaultDirName={code:DefaultInstallDir}
UsePreviousAppDir=no
; Updates and the MSI replacement install over the existing folder on purpose.
DirExistsWarning=no
DisableWelcomePage=no
DisableProgramGroupPage=yes
DisableReadyPage=yes
CloseApplications=yes
RestartApplications=no
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
italian.RunBrowserSetup=Configura le estensioni dei browser (collegamento automatico e caricamento guidato)
italian.RunLaunchApp=Avvia %1 al termine dell'installazione
italian.PrepCaption=Preparazione
italian.PrepDescription=Preparazione dell'installazione di Jesse's Archive...
italian.AppRunning=Jesse's Archive è aperto. Chiudilo, anche dall'area di notifica (clic destro sull'icona → Esci), poi scegli Riprova.
italian.AppStillRunning=Jesse's Archive è ancora aperto: chiudilo e avvia di nuovo l'installazione.
italian.WebView2Status=Installazione del componente Microsoft WebView2...
italian.WebView2Failed=Non è stato possibile installare Microsoft WebView2 (codice %1). Jesse's Archive ne ha bisogno per funzionare: avvia di nuovo l'installazione.
italian.OldRemoveStatus=Sostituzione della versione precedente...
italian.OldRemoveFailed=Non è stato possibile rimuovere la versione precedente installata con Windows Installer (codice %1). Disinstallala da Impostazioni → App → App installate, poi avvia di nuovo l'installazione. Il vault non viene toccato.
italian.UninstallDataKept=Jesse's Archive è stato rimosso. Il vault e le impostazioni non sono stati eliminati: reinstallando l'app li ritrovi.
english.RunBrowserSetup=Set up the browser extensions (automatic connection and guided loading)
english.RunLaunchApp=Start %1 when the installation finishes
english.PrepCaption=Preparing
english.PrepDescription=Preparing to install Jesse's Archive...
english.AppRunning=Jesse's Archive is open. Close it, also from the notification area (right-click the icon → Quit), then choose Retry.
english.AppStillRunning=Jesse's Archive is still open: close it and start the installation again.
english.WebView2Status=Installing the Microsoft WebView2 component...
english.WebView2Failed=Microsoft WebView2 could not be installed (code %1). Jesse's Archive needs it to work: start the installation again.
english.OldRemoveStatus=Replacing the previous version...
english.OldRemoveFailed=The previous version installed with Windows Installer could not be removed (code %1). Uninstall it from Settings → Apps → Installed apps, then start the installation again. The vault is not touched.
english.UninstallDataKept=Jesse's Archive has been removed. The vault and the settings were not deleted: reinstalling the app gives them back.
spanish.RunBrowserSetup=Configurar las extensiones del navegador (conexión automática y carga guiada)
spanish.RunLaunchApp=Iniciar %1 al terminar la instalación
spanish.PrepCaption=Preparación
spanish.PrepDescription=Preparando la instalación de Jesse's Archive...
spanish.AppRunning=Jesse's Archive está abierto. Ciérralo, también desde el área de notificación (clic derecho en el icono → Salir), y elige Reintentar.
spanish.AppStillRunning=Jesse's Archive sigue abierto: ciérralo y vuelve a iniciar la instalación.
spanish.WebView2Status=Instalando el componente Microsoft WebView2...
spanish.WebView2Failed=No se pudo instalar Microsoft WebView2 (código %1). Jesse's Archive lo necesita para funcionar: vuelve a iniciar la instalación.
spanish.OldRemoveStatus=Sustituyendo la versión anterior...
spanish.OldRemoveFailed=No se pudo quitar la versión anterior instalada con Windows Installer (código %1). Desinstálala desde Configuración → Aplicaciones → Aplicaciones instaladas y vuelve a iniciar la instalación. La bóveda no se toca.
spanish.UninstallDataKept=Jesse's Archive se ha quitado. La bóveda y la configuración no se han eliminado: al reinstalar la app vuelves a tenerlas.
french.RunBrowserSetup=Configurer les extensions des navigateurs (connexion automatique et chargement guidé)
french.RunLaunchApp=Lancer %1 à la fin de l'installation
french.PrepCaption=Préparation
french.PrepDescription=Préparation de l'installation de Jesse's Archive...
french.AppRunning=Jesse's Archive est ouvert. Fermez-le, y compris depuis la zone de notification (clic droit sur l'icône → Quitter), puis choisissez Réessayer.
french.AppStillRunning=Jesse's Archive est toujours ouvert : fermez-le et relancez l'installation.
french.WebView2Status=Installation du composant Microsoft WebView2...
french.WebView2Failed=Impossible d'installer Microsoft WebView2 (code %1). Jesse's Archive en a besoin pour fonctionner : relancez l'installation.
french.OldRemoveStatus=Remplacement de la version précédente...
french.OldRemoveFailed=Impossible de supprimer la version précédente installée avec Windows Installer (code %1). Désinstallez-la depuis Paramètres → Applications → Applications installées, puis relancez l'installation. Le coffre n'est pas touché.
french.UninstallDataKept=Jesse's Archive a été supprimé. Le coffre et les paramètres n'ont pas été effacés : en réinstallant l'app, vous les retrouvez.
german.RunBrowserSetup=Browser-Erweiterungen einrichten (automatische Verbindung und geführtes Laden)
german.RunLaunchApp=%1 nach der Installation starten
german.PrepCaption=Vorbereitung
german.PrepDescription=Die Installation von Jesse's Archive wird vorbereitet...
german.AppRunning=Jesse's Archive ist geöffnet. Schließe es, auch im Infobereich (Rechtsklick auf das Symbol → Beenden), und wähle dann Wiederholen.
german.AppStillRunning=Jesse's Archive ist noch geöffnet: Schließe es und starte die Installation erneut.
german.WebView2Status=Die Komponente Microsoft WebView2 wird installiert...
german.WebView2Failed=Microsoft WebView2 konnte nicht installiert werden (Code %1). Jesse's Archive benötigt es: Starte die Installation erneut.
german.OldRemoveStatus=Die vorherige Version wird ersetzt...
german.OldRemoveFailed=Die mit Windows Installer installierte vorherige Version konnte nicht entfernt werden (Code %1). Deinstalliere sie unter Einstellungen → Apps → Installierte Apps und starte die Installation erneut. Der Tresor bleibt unberührt.
german.UninstallDataKept=Jesse's Archive wurde entfernt. Tresor und Einstellungen wurden nicht gelöscht: Nach einer Neuinstallation sind sie wieder da.
brazilianportuguese.RunBrowserSetup=Configurar as extensões dos navegadores (conexão automática e carregamento guiado)
brazilianportuguese.RunLaunchApp=Iniciar o %1 ao final da instalação
brazilianportuguese.PrepCaption=Preparação
brazilianportuguese.PrepDescription=Preparando a instalação do Jesse's Archive...
brazilianportuguese.AppRunning=O Jesse's Archive está aberto. Feche-o, também na área de notificação (clique com o botão direito no ícone → Sair), e escolha Repetir.
brazilianportuguese.AppStillRunning=O Jesse's Archive ainda está aberto: feche-o e inicie a instalação novamente.
brazilianportuguese.WebView2Status=Instalando o componente Microsoft WebView2...
brazilianportuguese.WebView2Failed=Não foi possível instalar o Microsoft WebView2 (código %1). O Jesse's Archive precisa dele para funcionar: inicie a instalação novamente.
brazilianportuguese.OldRemoveStatus=Substituindo a versão anterior...
brazilianportuguese.OldRemoveFailed=Não foi possível remover a versão anterior instalada com o Windows Installer (código %1). Desinstale-a em Configurações → Aplicativos → Aplicativos instalados e inicie a instalação novamente. O cofre não é alterado.
brazilianportuguese.UninstallDataKept=O Jesse's Archive foi removido. O cofre e as configurações não foram apagados: reinstalando o app, você os recupera.
russian.RunBrowserSetup=Настроить расширения браузеров (автоматическое подключение и пошаговая загрузка)
russian.RunLaunchApp=Запустить %1 после завершения установки
russian.PrepCaption=Подготовка
russian.PrepDescription=Подготовка к установке Jesse's Archive...
russian.AppRunning=Jesse's Archive открыт. Закройте его, в том числе в области уведомлений (щелчок правой кнопкой по значку → Выход), затем нажмите «Повтор».
russian.AppStillRunning=Jesse's Archive всё ещё открыт: закройте его и запустите установку снова.
russian.WebView2Status=Установка компонента Microsoft WebView2...
russian.WebView2Failed=Не удалось установить Microsoft WebView2 (код %1). Он нужен для работы Jesse's Archive: запустите установку снова.
russian.OldRemoveStatus=Замена предыдущей версии...
russian.OldRemoveFailed=Не удалось удалить предыдущую версию, установленную через Windows Installer (код %1). Удалите её в «Параметры → Приложения → Установленные приложения» и запустите установку снова. Хранилище не затрагивается.
russian.UninstallDataKept=Jesse's Archive удалён. Хранилище и настройки не удалены: после повторной установки они снова будут доступны.
chinesesimplified.RunBrowserSetup=设置浏览器扩展（自动连接和引导加载）
chinesesimplified.RunLaunchApp=安装完成后启动 %1
chinesesimplified.PrepCaption=准备
chinesesimplified.PrepDescription=正在准备安装 Jesse's Archive...
chinesesimplified.AppRunning=Jesse's Archive 正在运行。请将其关闭（包括通知区域中的图标：右键单击 → 退出），然后选择“重试”。
chinesesimplified.AppStillRunning=Jesse's Archive 仍在运行：请将其关闭，然后重新开始安装。
chinesesimplified.WebView2Status=正在安装 Microsoft WebView2 组件...
chinesesimplified.WebView2Failed=无法安装 Microsoft WebView2（代码 %1）。Jesse's Archive 需要它才能运行：请重新开始安装。
chinesesimplified.OldRemoveStatus=正在替换旧版本...
chinesesimplified.OldRemoveFailed=无法移除通过 Windows Installer 安装的旧版本（代码 %1）。请在“设置 → 应用 → 已安装的应用”中将其卸载，然后重新开始安装。保险库不会受到影响。
chinesesimplified.UninstallDataKept=Jesse's Archive 已移除。保险库和设置没有被删除：重新安装应用后即可找回。
japanese.RunBrowserSetup=ブラウザー拡張機能を設定する (自動接続とガイド付きの読み込み)
japanese.RunLaunchApp=インストール完了後に %1 を起動する
japanese.PrepCaption=準備
japanese.PrepDescription=Jesse's Archive のインストールを準備しています...
japanese.AppRunning=Jesse's Archive が開いています。通知領域のアイコン (右クリック → 終了) も含めて閉じてから、[再試行] を選んでください。
japanese.AppStillRunning=Jesse's Archive がまだ開いています。閉じてから、もう一度インストールを開始してください。
japanese.WebView2Status=Microsoft WebView2 コンポーネントをインストールしています...
japanese.WebView2Failed=Microsoft WebView2 をインストールできませんでした (コード %1)。Jesse's Archive の動作に必要です。もう一度インストールを開始してください。
japanese.OldRemoveStatus=以前のバージョンを置き換えています...
japanese.OldRemoveFailed=Windows Installer でインストールされた以前のバージョンを削除できませんでした (コード %1)。[設定] → [アプリ] → [インストールされているアプリ] からアンインストールし、もう一度インストールを開始してください。保管庫は変更されません。
japanese.UninstallDataKept=Jesse's Archive を削除しました。保管庫と設定は削除されていません。アプリを再インストールすると元どおり使えます。
korean.RunBrowserSetup=브라우저 확장 프로그램 설정(자동 연결 및 안내형 로드)
korean.RunLaunchApp=설치가 끝나면 %1 실행
korean.PrepCaption=준비
korean.PrepDescription=Jesse's Archive 설치를 준비하는 중...
korean.AppRunning=Jesse's Archive가 열려 있습니다. 알림 영역의 아이콘(마우스 오른쪽 단추 → 종료)까지 닫은 다음 [다시 시도]를 선택하세요.
korean.AppStillRunning=Jesse's Archive가 아직 열려 있습니다. 닫은 다음 설치를 다시 시작하세요.
korean.WebView2Status=Microsoft WebView2 구성 요소를 설치하는 중...
korean.WebView2Failed=Microsoft WebView2를 설치할 수 없습니다(코드 %1). Jesse's Archive를 사용하려면 필요합니다. 설치를 다시 시작하세요.
korean.OldRemoveStatus=이전 버전을 교체하는 중...
korean.OldRemoveFailed=Windows Installer로 설치된 이전 버전을 제거할 수 없습니다(코드 %1). 설정 → 앱 → 설치된 앱에서 제거한 다음 설치를 다시 시작하세요. 보관함은 변경되지 않습니다.
korean.UninstallDataKept=Jesse's Archive가 제거되었습니다. 보관함과 설정은 삭제되지 않았으므로 앱을 다시 설치하면 그대로 사용할 수 있습니다.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Built by Build-Setup-EXE.ps1 (tauri build --no-bundle): same files the MSI installed.
Source: "..\src-tauri\target\release\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src-tauri\target\release\jesse_browser_host.exe"; DestDir: "{app}"; DestName: "jesse-browser-host.exe"; Flags: ignoreversion
Source: "..\browser-extension\chromium\*"; DestDir: "{app}\browser-extension\chromium"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\browser-extension\firefox\*"; DestDir: "{app}\browser-extension\firefox"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\BROWSER-INTEGRATION.md"; DestDir: "{app}\browser-extension"; Flags: ignoreversion
; Offline WebView2 runtime, installed only when missing (see PrepareToInstall).
Source: "payload\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"; Flags: dontcopy noencryption

[InstallDelete]
; Folders left by older versions are refreshed completely.
Type: filesandordirs; Name: "{app}\browser-extension\chromium"
Type: filesandordirs; Name: "{app}\browser-extension\firefox"

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; AppUserModelID: "app.jesse.archive"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; AppUserModelID: "app.jesse.archive"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Parameters: "--browser-setup"; Description: "{cm:RunBrowserSetup}"; Flags: postinstall nowait skipifsilent runasoriginaluser
; Must stay right after the browser entry: NextButtonClick refers to it as RunList item 1.
Filename: "{app}\{#AppExe}"; Description: "{cm:RunLaunchApp,{#AppName}}"; Flags: postinstall nowait skipifsilent runasoriginaluser
; Automatic update (/SILENT from the app): reopen the app once the files are replaced.
; Not a postinstall entry, so it is not part of the RunList above.
Filename: "{app}\{#AppExe}"; Flags: nowait runasoriginaluser; Check: WizardSilent

[Code]
const
  AppTitle = 'Jesse''s Archive';
  UninstallKey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall';
  WebView2Key = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2KeyWow = 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

{ Name and subtitle under the logo of the side image, as native labels: Windows draws them
  with ClearType at the current DPI, like the rest of the wizard text, which a transparent
  image cannot do. Heights match the layout of scripts/installer-art.ps1 (image 202x386). }
procedure AddBrandLabel(Image: TBitmapImage; Caption, FontName: String; FontSize, Top: Integer; Color: TColor);
var
  L: TLabel;
begin
  L := TLabel.Create(WizardForm);
  L.Parent := Image.Parent;
  L.StyleElements := [seClient, seBorder];
  L.Transparent := True;
  L.AutoSize := False;
  L.Alignment := taCenter;
  L.ShowAccelChar := False;
  L.Font.Name := FontName;
  L.Font.Size := FontSize;
  L.Font.Color := Color;
  L.Caption := Caption;
  L.SetBounds(Image.Left, Image.Top + MulDiv(Image.Height, Top, 386), Image.Width, MulDiv(Image.Height, 30, 386));
  L.BringToFront;
end;

procedure AddBrandLabels(Image: TBitmapImage);
begin
  AddBrandLabel(Image, AppTitle, 'Segoe UI Semibold', 14, 214, $F5EAE9);
  AddBrandLabel(Image, 'Password manager', 'Segoe UI', 9, 246, $AB9693);
end;

procedure InitializeWizard;
begin
  AddBrandLabels(WizardForm.WizardBitmapImage);
  AddBrandLabels(WizardForm.WizardBitmapImage2);
end;

{ Number of running processes with this executable name (WMI). }
function ProcessCount(Name: String): Integer;
var
  Locator, Service, Items: Variant;
begin
  Result := 0;
  try
    Locator := CreateOleObject('WbemScripting.SWbemLocator');
    Service := Locator.ConnectServer('.', 'root\CIMV2');
    Items := Service.ExecQuery('SELECT ProcessId FROM Win32_Process WHERE Name = ''' + Name + '''');
    Result := Items.Count;
  except
    Log('Controllo dei processi non riuscito: ' + GetExceptionMessage);
  end;
end;

{ The browser relay is stateless: the extension reconnects to the new one by itself. }
procedure StopBrowserHost;
var
  Code: Integer;
begin
  if ProcessCount('jesse-browser-host.exe') + ProcessCount('jesse_browser_host.exe') > 0 then
  begin
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM jesse-browser-host.exe', '', SW_HIDE, ewWaitUntilTerminated, Code);
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM jesse_browser_host.exe', '', SW_HIDE, ewWaitUntilTerminated, Code);
    Sleep(300);
  end;
end;

{ The app must be closed before its files are replaced. The automatic update closes it
  right after starting the setup, so a silent run waits a little. }
function WaitForAppClosed(Interactive: Boolean): Boolean;
var
  Tries: Integer;
begin
  Result := True;
  Tries := 0;
  while ProcessCount('{#AppExe}') > 0 do
  begin
    if Interactive then
    begin
      if MsgBox(CustomMessage('AppRunning'), mbError, MB_RETRYCANCEL) <> IDRETRY then
      begin
        Result := False;
        Exit;
      end;
    end
    else
    begin
      Tries := Tries + 1;
      if Tries > 60 then
      begin
        Result := False;
        Exit;
      end;
      Sleep(500);
    end;
  end;
end;

{ Product code and folder of the Tauri/WiX MSI install (Beta 1.1.21 and earlier). }
function FindMsiInstall(var ProductCode, Location: String): Boolean;
var
  Names: TArrayOfString;
  I, View: Integer;
  Root: Integer;
  Name, Display: String;
  IsMsi: Cardinal;
begin
  Result := False;
  for View := 0 to 1 do
  begin
    if View = 0 then Root := HKLM64 else Root := HKLM32;
    if RegGetSubkeyNames(Root, UninstallKey, Names) then
      for I := 0 to GetArrayLength(Names) - 1 do
      begin
        Name := Names[I];
        if (Copy(Name, 1, 1) = '{') and (Pos('_is1', Name) = 0)
          and RegQueryStringValue(Root, UninstallKey + '\' + Name, 'DisplayName', Display)
          and (Display = AppTitle)
          and RegQueryDWordValue(Root, UninstallKey + '\' + Name, 'WindowsInstaller', IsMsi)
          and (IsMsi = 1) then
        begin
          ProductCode := Name;
          if not RegQueryStringValue(Root, UninstallKey + '\' + Name, 'InstallLocation', Location) then
            Location := '';
          Result := True;
          Exit;
        end;
      end;
  end;
end;

{ Folder: /INSTALLDIR= (automatic update), then a previous install of this setup, then
  the folder of the old MSI install, then Program Files. }
function DefaultInstallDir(Param: String): String;
var
  Code, Location: String;
begin
  Result := Trim(ExpandConstant('{param:INSTALLDIR|}'));
  if (Result <> '') and (Pos('"', Result) = 0) then
    Exit;
  if RegQueryStringValue(HKLM64, UninstallKey + '\{{#AppGuid}}_is1', 'InstallLocation', Result)
    and (Trim(Result) <> '') then
  begin
    Result := RemoveBackslashUnlessRoot(Trim(Result));
    Exit;
  end;
  if FindMsiInstall(Code, Location) and (Trim(Location) <> '') then
  begin
    Result := RemoveBackslashUnlessRoot(Trim(Location));
    Exit;
  end;
  Result := ExpandConstant('{autopf}\') + AppTitle;
end;

function WebView2Installed: Boolean;
var
  Version: String;
begin
  Result := (RegQueryStringValue(HKLM, WebView2KeyWow, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'))
    or (RegQueryStringValue(HKLM, WebView2Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'))
    or (RegQueryStringValue(HKCU, WebView2Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  { Finish clicked: the postinstall entries run after this returns. When the browser
    guide is selected it already starts the app, and its "Ho installato l'estensione"
    button brings the main window up; launching a second instance at the same time
    would race the single-instance check, so the plain launch is skipped. }
  if (CurPageID = wpFinished) and (WizardForm.RunList.Items.Count >= 2) then
    if WizardForm.RunList.Checked[0] and WizardForm.RunList.Checked[1] then
    begin
      Log('Guida estensioni selezionata: avvio semplice saltato, la guida aprira'' l''app.');
      WizardForm.RunList.Checked[1] := False;
    end;
end;

{ Runs before any file is copied: a failure leaves the current install untouched. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Page: TOutputMarqueeProgressWizardPage;
  Code: Integer;
  ProductCode, Location: String;
begin
  Result := '';
  if not WaitForAppClosed(not WizardSilent) then
  begin
    Result := CustomMessage('AppStillRunning');
    Exit;
  end;
  StopBrowserHost;
  Page := CreateOutputMarqueeProgressPage(CustomMessage('PrepCaption'), CustomMessage('PrepDescription'));
  Page.Show;
  try
    Page.Animate;
    if not WebView2Installed then
    begin
      Page.SetText(CustomMessage('WebView2Status'), '');
      ExtractTemporaryFile('MicrosoftEdgeWebView2RuntimeInstallerX64.exe');
      if not Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebView2RuntimeInstallerX64.exe'), '/silent /install', '',
        SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
      begin
        Log('Installazione WebView2 non riuscita, codice ' + IntToStr(Code));
        Result := FmtMessage(CustomMessage('WebView2Failed'), [IntToStr(Code)]);
        Exit;
      end;
    end;
    { Beta 1.1.21 and earlier were an MSI: remove its registration and files (the vault
      lives in AppData and is not part of it), then this setup installs in the same folder. }
    if FindMsiInstall(ProductCode, Location) then
    begin
      Page.SetText(CustomMessage('OldRemoveStatus'), '');
      Log('Rimozione MSI precedente ' + ProductCode + ' in ' + Location);
      Exec(ExpandConstant('{sys}\msiexec.exe'), '/x ' + ProductCode + ' /qn /norestart', '',
        SW_HIDE, ewWaitUntilTerminated, Code);
      Log('Codice di uscita msiexec: ' + IntToStr(Code));
      { 1605: already gone. 3010: removed, restart only suggested. }
      if (Code <> 0) and (Code <> 1605) and (Code <> 3010) then
      begin
        Result := FmtMessage(CustomMessage('OldRemoveFailed'), [IntToStr(Code)]);
        Exit;
      end;
    end;
  finally
    Page.Hide;
  end;
end;

function InitializeUninstall: Boolean;
begin
  Result := True;
  while ProcessCount('{#AppExe}') > 0 do
  begin
    if UninstallSilent then
    begin
      Result := False;
      Exit;
    end;
    if MsgBox(CustomMessage('AppRunning'), mbError, MB_RETRYCANCEL) <> IDRETRY then
    begin
      Result := False;
      Exit;
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Vendors: TArrayOfString;
  I: Integer;
begin
  if CurUninstallStep = usUninstall then
    StopBrowserHost;
  if CurUninstallStep = usPostUninstall then
  begin
    { Registrations the app made for the current user would point to a missing program.
      The vault, the settings and the browser files in AppData are kept. }
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'JesseArchive');
    SetArrayLength(Vendors, 7);
    Vendors[0] := 'Google\Chrome';
    Vendors[1] := 'Microsoft\Edge';
    Vendors[2] := 'BraveSoftware\Brave-Browser';
    Vendors[3] := 'Opera Software';
    Vendors[4] := 'Vivaldi';
    Vendors[5] := 'Chromium';
    Vendors[6] := 'Mozilla';
    for I := 0 to GetArrayLength(Vendors) - 1 do
      RegDeleteKeyIncludingSubkeys(HKCU, 'Software\' + Vendors[I] + '\NativeMessagingHosts\com.jessearchive.browser');
    if not UninstallSilent then
      MsgBox(CustomMessage('UninstallDataKept'), mbInformation, MB_OK);
  end;
end;
