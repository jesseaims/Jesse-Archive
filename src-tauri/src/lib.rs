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
fn choose_icon_data()->Result<Option<String>,String>{
 use base64::{engine::general_purpose::STANDARD,Engine as _};
 let path=match rfd::FileDialog::new().add_filter("Immagini", &["png","jpg","jpeg","webp","ico"]).pick_file(){Some(p)=>p,None=>return Ok(None)};
 let ext=path.extension().and_then(|e|e.to_str()).unwrap_or("").to_ascii_lowercase();
 let mime=match ext.as_str(){"png"=>"image/png","jpg"|"jpeg"=>"image/jpeg","webp"=>"image/webp","ico"=>"image/x-icon",_=>return Err("Formato immagine non supportato".into())};
 let meta=std::fs::metadata(&path).map_err(|e|e.to_string())?;
 if meta.len()>150_000{return Err("Logo troppo grande (massimo 150 KB). Riduci l'immagine e riprova.".into())}
 let bytes=std::fs::read(&path).map_err(|e|e.to_string())?;
 // Basic file magic validation before persisting untrusted image data.
 let valid=match ext.as_str(){"png"=>bytes.starts_with(b"\x89PNG\r\n\x1a\n"),"jpg"|"jpeg"=>bytes.starts_with(&[0xff,0xd8,0xff]),"webp"=>bytes.starts_with(b"RIFF")&&bytes.get(8..12)==Some(&b"WEBP"[..]),"ico"=>bytes.starts_with(&[0,0,1,0]),_=>false};
 if !valid{return Err("Il contenuto del file non corrisponde al formato immagine selezionato".into())}
 Ok(Some(format!("data:{};base64,{}",mime,STANDARD.encode(bytes))))
}

#[tauri::command]
fn read_file(path:String)->Result<String,String>{let file=std::path::Path::new(&path);let meta=std::fs::metadata(file).map_err(|e|e.to_string())?;if meta.len()>20_000_000{return Err("File oltre 20 MB".into())}std::fs::read_to_string(file).map_err(|e|e.to_string())}
#[tauri::command]
fn save_file(name:String,text:String)->Result<bool,String>{let dialog=rfd::FileDialog::new().set_file_name(&name);if let Some(p)=dialog.save_file(){if p.exists(){return Err("File già esistente: scegli un nuovo nome per evitare sovrascritture".into())}std::fs::write(p,text).map_err(|e|e.to_string())?;Ok(true)}else{Ok(false)}}
// Native Windows clipboard: no PowerShell, CMD or console window is created.
// Copy and expiration are executed on a blocking worker, not on the webview UI thread.
#[tauri::command]
async fn copy_secret(text: String) -> Result<(), String> {
    #[cfg(windows)] {
        return tauri::async_runtime::spawn_blocking(move || {
            clipboard_win::set_clipboard(clipboard_win::formats::Unicode, text.as_str())
                .map_err(|e| format!("Impossibile copiare negli appunti: {e}"))
        })
        .await
        .map_err(|e| format!("Errore nel thread degli appunti: {e}"))?;
    }
    #[cfg(not(windows))] {
        let _ = text;
        Err("Clipboard disponibile nella build Windows".into())
    }
}

#[tauri::command]
async fn clear_secret_if_unchanged(expected: String) -> Result<(), String> {
    #[cfg(windows)] {
        return tauri::async_runtime::spawn_blocking(move || {
            use clipboard_win::{Clipboard, Getter, Setter, formats};
            // The clipboard must remain open for the entire compare-and-clear
            // operation, preventing a separate app changing it between calls.
            let _guard = Clipboard::new_attempts(10)
                .map_err(|e| format!("Impossibile accedere agli appunti: {e}"))?;
            let mut current = String::new();
            if formats::Unicode.read_clipboard(&mut current).is_ok() && current == expected {
                formats::Unicode.write_clipboard(&String::new())
                    .map_err(|e| format!("Impossibile pulire gli appunti: {e}"))?;
            }
            Ok(())
        })
        .await
        .map_err(|e| format!("Errore nel thread degli appunti: {e}"))?;
    }
    #[cfg(not(windows))] {
        let _ = expected;
        Ok(())
    }
}

pub fn run(){tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app,_,_|{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}})).manage(AppState(Mutex::new(core::Vault::new()))).setup(|app|{use tauri::menu::{Menu,MenuItem};use tauri::tray::TrayIconBuilder;let show=MenuItem::with_id(app,"show","Apri Jesse's Archive",true,None::<&str>)?;let lock=MenuItem::with_id(app,"lock","Blocca il vault",true,None::<&str>)?;let quit=MenuItem::with_id(app,"quit","Esci",true,None::<&str>)?;let menu=Menu::with_items(app,&[&show,&lock,&quit])?;let mut tray=TrayIconBuilder::new().menu(&menu).on_menu_event(|app,event|{match event.id().as_ref(){"show"=>{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}},"lock"=>{if let Some(st)=app.try_state::<AppState>(){if let Ok(mut vault)=st.0.lock(){let _=vault.call("lock",serde_json::json!({}));}}let _=app.emit("vault-locked",());},"quit"=>app.exit(0),_=>()}});if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone());}let _=tray.build(app)?;if std::env::args().any(|a|a=="--background"){if let Some(w)=app.get_webview_window("main"){let _=w.hide();}}Ok(())}).on_window_event(|win,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event{let app=win.app_handle();if let Some(st)=app.try_state::<AppState>(){if let Ok(mut v)=st.0.lock(){let mode=v.close_action();if mode=="tray"{let _=v.call("lock",serde_json::json!({}));api.prevent_close();let _=win.hide();}}}}}).invoke_handler(tauri::generate_handler![api,choose_file,choose_icon_data,read_file,save_file,copy_secret,clear_secret_if_unchanged]).run(tauri::generate_context!()).expect("Tauri application failed");}
