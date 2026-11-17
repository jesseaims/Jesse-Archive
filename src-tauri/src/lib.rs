mod core;
use std::sync::Mutex;
use serde_json::Value;
use tauri::{Manager,Emitter};

struct AppState(Mutex<core::Vault>);

#[tauri::command]
async fn api(state:tauri::State<'_,AppState>,name:String,body:Value)->Result<Value,String>{let mut core=state.0.lock().map_err(|_|"Stato applicazione non disponibile".to_string())?;core.call(&name,body)}

#[tauri::command]
fn choose_file(mode:String)->Result<Option<String>,String>{let dialog=rfd::FileDialog::new();let p=match mode.as_str(){"vault_folder"=>dialog.pick_folder(),"import"=>dialog.add_filter("Importazione",&["csv","json","jshare","txt"]).pick_file(),"icon"=>dialog.add_filter("Immagini",&["png","jpg","jpeg","ico"]).pick_file(),_=>dialog.pick_file()};Ok(p.map(|p|p.to_string_lossy().to_string()))}
#[tauri::command]
fn read_file(path:String)->Result<String,String>{let file=std::path::Path::new(&path);let meta=std::fs::metadata(file).map_err(|e|e.to_string())?;if meta.len()>20_000_000{return Err("File oltre 20 MB".into())}std::fs::read_to_string(file).map_err(|e|e.to_string())}
#[tauri::command]
fn save_file(name:String,text:String)->Result<bool,String>{let dialog=rfd::FileDialog::new().set_file_name(&name);if let Some(p)=dialog.save_file(){if p.exists(){return Err("File già esistente: scegli un nuovo nome per evitare sovrascritture".into())}std::fs::write(p,text).map_err(|e|e.to_string())?;Ok(true)}else{Ok(false)}}
#[tauri::command]
fn copy_secret(text:String)->Result<(),String>{#[cfg(windows)]{use std::io::Write;let mut child=std::process::Command::new("powershell").args(["-NoProfile","-NonInteractive","-Command","[Console]::InputEncoding=[Text.UTF8Encoding]::new();Set-Clipboard -Value ([Console]::In.ReadToEnd())"]).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::null()).spawn().map_err(|e|e.to_string())?;child.stdin.take().ok_or("clipboard non disponibile")?.write_all(text.as_bytes()).map_err(|e|e.to_string())?;child.wait().map_err(|e|e.to_string())?;return Ok(())}#[cfg(not(windows))]{let _=text;Err("Clipboard disponibile nella build Windows".into())}}


#[tauri::command]
fn clear_secret_if_unchanged(expected:String)->Result<(),String>{
    #[cfg(windows)]{
        use std::io::Write;
        let script="[Console]::InputEncoding=[Text.UTF8Encoding]::new();$expected=[Console]::In.ReadToEnd();$current=Get-Clipboard -Raw -ErrorAction SilentlyContinue;if($current -eq $expected){Set-Clipboard -Value ''}";
        let mut child=std::process::Command::new("powershell")
            .args(["-NoProfile","-NonInteractive","-Command",script])
            .stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::null())
            .spawn().map_err(|e|e.to_string())?;
        child.stdin.take().ok_or("clipboard non disponibile")?.write_all(expected.as_bytes()).map_err(|e|e.to_string())?;
        child.wait().map_err(|e|e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]{let _=expected;Ok(())}
}

pub fn run(){tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app,_,_|{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}})).manage(AppState(Mutex::new(core::Vault::new()))).setup(|app|{use tauri::menu::{Menu,MenuItem};use tauri::tray::TrayIconBuilder;let show=MenuItem::with_id(app,"show","Apri Jesse's Archive",true,None::<&str>)?;let lock=MenuItem::with_id(app,"lock","Blocca il vault",true,None::<&str>)?;let quit=MenuItem::with_id(app,"quit","Esci",true,None::<&str>)?;let menu=Menu::with_items(app,&[&show,&lock,&quit])?;let mut tray=TrayIconBuilder::new().menu(&menu).on_menu_event(|app,event|{match event.id().as_ref(){"show"=>{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}},"lock"=>{if let Some(st)=app.try_state::<AppState>(){if let Ok(mut vault)=st.0.lock(){let _=vault.call("lock",serde_json::json!({}));}}let _=app.emit("vault-locked",());},"quit"=>app.exit(0),_=>()}});if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone());}let _=tray.build(app)?;if std::env::args().any(|a|a=="--background"){if let Some(w)=app.get_webview_window("main"){let _=w.hide();}}Ok(())}).on_window_event(|win,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event{let app=win.app_handle();if let Some(st)=app.try_state::<AppState>(){if let Ok(mut v)=st.0.lock(){let mode=v.close_action();if mode=="tray"{let _=v.call("lock",serde_json::json!({}));api.prevent_close();let _=win.hide();}}}}}).invoke_handler(tauri::generate_handler![api,choose_file,read_file,save_file,copy_secret,clear_secret_if_unchanged]).run(tauri::generate_context!()).expect("Tauri application failed");}
