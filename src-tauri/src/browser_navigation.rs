//! Navigate only a newly created, verified browser window. Chromium filters
//! privileged internal URLs on its command line, including extensions pages.
use std::{
    path::Path,
    time::{Duration, Instant},
};
use windows_sys::Win32::{
    Foundation::{CloseHandle, HWND, LPARAM},
    System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    },
    UI::{
        Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
            KEYEVENTF_UNICODE, VK_CONTROL, VK_RETURN,
        },
        WindowsAndMessaging::{
            EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowThreadProcessId,
            IsWindowVisible, SetForegroundWindow, ShowWindow, SW_RESTORE,
        },
    },
};

struct Search<'a> {
    executable: &'a Path,
    opera: bool,
    windows: Vec<isize>,
}
fn matching_process(hwnd: HWND, expected: &Path, opera: bool) -> bool {
    unsafe {
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return false;
        }
        let mut path = vec![0u16; 32768];
        let mut length = path.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, path.as_mut_ptr(), &mut length) != 0;
        CloseHandle(process);
        if !ok {
            return false;
        }
        let actual = String::from_utf16_lossy(&path[..length as usize])
            .replace('/', "\\")
            .to_lowercase();
        let expected = expected.to_string_lossy().replace('/', "\\").to_lowercase();
        if actual == expected {
            return true;
        }
        // Opera's launcher lives above its versioned opera.exe executable.
        opera
            && Path::new(&actual)
                .file_name()
                .is_some_and(|n| n == "opera.exe")
            && Path::new(&actual).starts_with(
                Path::new(&expected)
                    .parent()
                    .unwrap_or(Path::new("__invalid__")),
            )
    }
}
unsafe extern "system" fn visit(hwnd: HWND, param: LPARAM) -> i32 {
    let search = &mut *(param as *mut Search<'_>);
    if IsWindowVisible(hwnd) == 0 {
        return 1;
    }
    let mut class = [0u16; 128];
    let length = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32);
    let class = String::from_utf16_lossy(&class[..length.max(0) as usize]);
    if ["Chrome_WidgetWin_1", "MozillaWindowClass"].contains(&class.as_str())
        && matching_process(hwnd, search.executable, search.opera)
    {
        search.windows.push(hwnd as isize);
    }
    1
}
fn windows(executable: &Path, opera: bool) -> Vec<isize> {
    let mut search = Search {
        executable,
        opera,
        windows: Vec::new(),
    };
    unsafe {
        EnumWindows(Some(visit), &mut search as *mut Search<'_> as LPARAM);
    }
    search.windows
}
fn key(vk: u16, scan: u16, flags: u32) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: scan,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}
fn send(hwnd: HWND, inputs: &[INPUT]) -> Result<(), String> {
    unsafe {
        if GetForegroundWindow() != hwnd {
            return Err(
                "Il browser non è più in primo piano. Premi di nuovo Apri pagina estensioni."
                    .into(),
            );
        }
        if SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        ) != inputs.len() as u32
        {
            return Err("Windows non ha consentito la navigazione. Apri la pagina con l'indirizzo indicato nella guida.".into());
        }
    }
    Ok(())
}
fn address_inputs(page: &str) -> Vec<INPUT> {
    let mut inputs = Vec::new();
    for unit in page.encode_utf16() {
        inputs.push(key(0, unit, KEYEVENTF_UNICODE));
        inputs.push(key(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
    }
    inputs.push(key(VK_RETURN, 0, 0));
    inputs.push(key(VK_RETURN, 0, KEYEVENTF_KEYUP));
    inputs
}
pub fn open(executable: &Path, id: &str, page: &str) -> Result<(), String> {
    open_with_args(executable, id, page, &[]).map(|_| ())
}
fn open_with_args(
    executable: &Path,
    id: &str,
    page: &str,
    extra: &[String],
) -> Result<isize, String> {
    use std::os::windows::process::CommandExt;
    let before = windows(executable, id == "opera");
    std::process::Command::new(executable)
        .args(extra)
        .arg("--new-window")
        .arg("about:blank")
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Impossibile aprire il browser: {e}"))?;
    let deadline = Instant::now() + Duration::from_secs(15);
    let hwnd = loop {
        if let Some(hwnd) = windows(executable, id == "opera")
            .into_iter()
            .find(|h| !before.contains(h))
        {
            break hwnd as HWND;
        }
        if Instant::now() > deadline {
            return Err("Il browser non ha aperto una nuova finestra. Completa eventuali schermate iniziali e riprova.".into());
        }
        std::thread::sleep(Duration::from_millis(150));
    };
    std::thread::sleep(Duration::from_millis(500));
    unsafe {
        ShowWindow(hwnd, SW_RESTORE);
        SetForegroundWindow(hwnd);
    }
    std::thread::sleep(Duration::from_millis(150));
    // One batch releases modifiers before typing, without using the clipboard.
    send(
        hwnd,
        &[
            key(VK_CONTROL, 0, 0),
            key(b'L' as u16, 0, 0),
            key(b'L' as u16, 0, KEYEVENTF_KEYUP),
            key(VK_CONTROL, 0, KEYEVENTF_KEYUP),
        ],
    )?;
    std::thread::sleep(Duration::from_millis(120));
    send(hwnd, &address_inputs(page))?;
    Ok(hwnd as isize)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn navigation_uses_unicode_and_submits_once() {
        let inputs = address_inputs("brave://extensions/");
        assert_eq!(
            inputs.len(),
            "brave://extensions/".encode_utf16().count() * 2 + 2
        );
        unsafe {
            assert_eq!(inputs[inputs.len() - 2].Anonymous.ki.wVk, VK_RETURN);
            assert_eq!(inputs[0].Anonymous.ki.dwFlags, KEYEVENTF_UNICODE);
        }
    }
    #[test]
    #[ignore = "Opens a dedicated Brave test window, requires an interactive Windows desktop"]
    fn brave_opens_extensions_page() {
        let exe = std::path::PathBuf::from(
            "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
        );
        let profile = std::env::current_dir()
            .unwrap()
            .join("target/browser-navigation-test");
        std::fs::create_dir_all(&profile).unwrap();
        let hwnd = open_with_args(
            &exe,
            "brave",
            "brave://extensions/",
            &[
                format!("--user-data-dir={}", profile.display()),
                "--remote-debugging-port=0".into(),
                "--no-first-run".into(),
                "--no-default-browser-check".into(),
                "--disable-background-mode".into(),
            ],
        )
        .unwrap();
        let result = std::panic::catch_unwind(|| {
            let deadline = Instant::now() + Duration::from_secs(10);
            let client = reqwest::blocking::Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(1))
                .build()
                .unwrap();
            let mut observed = Vec::<String>::new();
            loop {
                let port = std::fs::read_to_string(profile.join("DevToolsActivePort"))
                    .ok()
                    .and_then(|s| s.lines().next().map(str::to_owned));
                if let Some(port) = port {
                    if let Ok(response) = client
                        .get(format!("http://127.0.0.1:{port}/json/list"))
                        .send()
                    {
                        if let Ok(text) = response.text() {
                            if let Ok(tabs) = serde_json::from_str::<serde_json::Value>(&text) {
                                observed = tabs
                                    .as_array()
                                    .map(|tabs| {
                                        tabs.iter()
                                            .filter_map(|t| t["url"].as_str().map(str::to_owned))
                                            .collect()
                                    })
                                    .unwrap_or_default();
                                if observed.iter().any(|url| {
                                    url == "brave://extensions/" || url == "chrome://extensions/"
                                }) {
                                    return;
                                }
                            }
                        }
                    }
                }
                assert!(
                    Instant::now() < deadline,
                    "Brave did not navigate to its extensions page: {observed:?}"
                );
                std::thread::sleep(Duration::from_millis(200));
            }
        });
        unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::PostMessageW(
                hwnd as HWND,
                windows_sys::Win32::UI::WindowsAndMessaging::WM_CLOSE,
                0,
                0,
            );
        }
        result.unwrap();
    }
}
