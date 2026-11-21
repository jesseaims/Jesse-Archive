//! Local channel between the browser helper and the app (SEC-07): the token file
//! readable only by the current user, a handshake with an overall deadline, limits
//! on pending and connected clients, and a message rate limit.
//!
//! What this protects from: other Windows users and processes without access to the
//! user's profile, and local programs that open many connections or flood the app.
//! It does not protect from hostile code already running as the same user, which can
//! read the file or start the helper itself: credentials still leave the vault only
//! after an explicit choice in the mini window.
use crate::browser_protocol as wire;
use std::{
    io::{self, Read},
    net::{TcpListener, TcpStream},
    path::Path,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

#[derive(Clone, Copy)]
pub struct Limits {
    /// Time to send the whole token frame, not per read.
    pub handshake: Duration,
    /// Connections waiting to present the token; newer ones are closed at once.
    pub pending: usize,
    /// Authenticated connections at the same time (one per browser profile).
    pub clients: usize,
    /// At most `burst` messages per `window` from one client.
    pub burst: usize,
    pub window: Duration,
}
pub const LIMITS: Limits = Limits {
    handshake: Duration::from_secs(3),
    pending: 8,
    clients: 16,
    burst: 200,
    window: Duration::from_secs(10),
};

/// Counts messages in fixed windows; `allow` turns false once a window is over the
/// limit, and the caller closes the connection.
pub struct Rate {
    limits: Limits,
    start: Instant,
    count: usize,
}
impl Rate {
    pub fn new(limits: Limits) -> Self {
        Rate {
            limits,
            start: Instant::now(),
            count: 0,
        }
    }
    pub fn allow(&mut self) -> bool {
        if self.start.elapsed() >= self.limits.window {
            self.start = Instant::now();
            self.count = 0;
        }
        self.count += 1;
        self.count <= self.limits.burst
    }
}

/// Reads from the socket while the overall deadline lasts.
struct Deadline<'a> {
    socket: &'a mut TcpStream,
    end: Instant,
}
impl Read for Deadline<'_> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let left = self.end.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Err(io::ErrorKind::TimedOut.into());
        }
        self.socket.set_read_timeout(Some(left))?;
        self.socket.read(buf)
    }
}
/// Same result whatever the position of the first different byte.
fn same_token(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |d, (x, y)| d | (x ^ y)) == 0
}
fn authenticate(socket: &mut TcpStream, token: &str, limit: Duration) -> bool {
    let mut reader = Deadline {
        socket,
        end: Instant::now() + limit,
    };
    let ok = wire::read_frame(&mut reader)
        .ok()
        .and_then(|v| v["token"].as_str().map(|t| same_token(t, token)))
        .unwrap_or(false);
    ok && socket.set_read_timeout(None).is_ok()
}
/// Decrements a counter when dropped, whichever way the thread ends.
struct Slot(Arc<AtomicUsize>);
impl Drop for Slot {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}
fn take(counter: &Arc<AtomicUsize>, max: usize) -> Option<Slot> {
    let mut n = counter.load(Ordering::SeqCst);
    loop {
        if n >= max {
            return None;
        }
        match counter.compare_exchange(n, n + 1, Ordering::SeqCst, Ordering::SeqCst) {
            Ok(_) => return Some(Slot(counter.clone())),
            Err(now) => n = now,
        }
    }
}
/// Accepts connections; each one that presents the token within the limits runs
/// `session` on its own thread.
pub fn serve<F>(listener: TcpListener, token: String, limits: Limits, session: F)
where
    F: Fn(TcpStream) + Send + Sync + 'static,
{
    let session = Arc::new(session);
    let pending = Arc::new(AtomicUsize::new(0));
    let clients = Arc::new(AtomicUsize::new(0));
    for socket in listener.incoming().flatten() {
        let Some(waiting) = take(&pending, limits.pending) else {
            continue;
        };
        let (session, clients, token) = (session.clone(), clients.clone(), token.clone());
        std::thread::spawn(move || {
            let mut socket = socket;
            let ok = authenticate(&mut socket, &token, limits.handshake);
            drop(waiting);
            if !ok {
                return;
            }
            let Some(_client) = take(&clients, limits.clients) else {
                return;
            };
            session(socket);
        });
    }
}

/// Writes `bytes` to `path` so that only the current user and SYSTEM can open it,
/// whatever the folder lets others do: a temporary file created with that access,
/// then moved over the old one (a move keeps the file's own permissions).
pub fn write_private(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let temp = path.with_extension("tmp");
    let _ = std::fs::remove_file(&temp);
    {
        use std::io::Write;
        let mut file = create_private(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&temp, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&temp);
    })
}
#[cfg(not(windows))]
fn create_private(path: &Path) -> io::Result<std::fs::File> {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
}
#[cfg(windows)]
fn create_private(path: &Path) -> io::Result<std::fs::File> {
    use std::os::windows::{ffi::OsStrExt, io::FromRawHandle};
    use windows_sys::Win32::{
        Foundation::{LocalFree, GENERIC_WRITE, INVALID_HANDLE_VALUE},
        Security::{
            Authorization::{
                ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
            },
            SECURITY_ATTRIBUTES,
        },
        Storage::FileSystem::{CreateFileW, CREATE_NEW, FILE_ATTRIBUTE_NORMAL},
    };
    let wide = |s: &std::ffi::OsStr| s.encode_wide().chain([0]).collect::<Vec<u16>>();
    // Protected DACL (P: nothing inherited from the folder): full access for the
    // current user and SYSTEM only.
    let sddl = format!("D:P(A;;FA;;;{})(A;;FA;;;SY)", user_sid()?);
    let mut descriptor = std::ptr::null_mut();
    // SAFETY: valid NUL-terminated input; the descriptor is freed below.
    if unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            wide(sddl.as_ref()).as_ptr(),
            SDDL_REVISION_1,
            &mut descriptor,
            std::ptr::null_mut(),
        )
    } == 0
    {
        return Err(io::Error::last_os_error());
    }
    let attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor,
        bInheritHandle: 0,
    };
    // SAFETY: valid path and attributes; CREATE_NEW applies them to a new file only.
    let handle = unsafe {
        CreateFileW(
            wide(path.as_os_str()).as_ptr(),
            GENERIC_WRITE,
            0,
            &attributes,
            CREATE_NEW,
            FILE_ATTRIBUTE_NORMAL,
            std::ptr::null_mut(),
        )
    };
    let error = io::Error::last_os_error();
    // SAFETY: allocated by ConvertStringSecurityDescriptorToSecurityDescriptorW.
    unsafe { LocalFree(descriptor) };
    if handle == INVALID_HANDLE_VALUE {
        return Err(error);
    }
    // SAFETY: a valid handle we own from here on.
    Ok(unsafe { std::fs::File::from_raw_handle(handle) })
}
/// SID of the user running the app, as a string ("S-1-5-21-…").
#[cfg(windows)]
pub(crate) fn user_sid() -> io::Result<String> {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, LocalFree},
        Security::{
            Authorization::ConvertSidToStringSidW, GetTokenInformation, TokenUser, TOKEN_QUERY,
            TOKEN_USER,
        },
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };
    let mut token = std::ptr::null_mut();
    // SAFETY: the pseudo-handle of the current process; the token is closed below.
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let mut buffer = vec![0u64; 64];
    let mut size = 0;
    // SAFETY: the buffer is large and aligned enough for TOKEN_USER and its SID.
    let ok = unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            buffer.as_mut_ptr().cast(),
            (buffer.len() * 8) as u32,
            &mut size,
        )
    };
    let error = io::Error::last_os_error();
    // SAFETY: opened above.
    unsafe { CloseHandle(token) };
    if ok == 0 {
        return Err(error);
    }
    // SAFETY: filled by GetTokenInformation(TokenUser).
    let sid = unsafe { (*buffer.as_ptr().cast::<TOKEN_USER>()).User.Sid };
    let mut text = std::ptr::null_mut();
    // SAFETY: valid SID; the string is freed with LocalFree.
    if unsafe { ConvertSidToStringSidW(sid, &mut text) } == 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: NUL-terminated string returned by ConvertSidToStringSidW.
    let result = unsafe {
        let len = (0..).take_while(|&i| *text.add(i) != 0).count();
        String::from_utf16_lossy(std::slice::from_raw_parts(text, len))
    };
    // SAFETY: allocated by ConvertSidToStringSidW.
    unsafe { LocalFree(text.cast()) };
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::{
        io::Write,
        sync::mpsc,
        time::{Duration, Instant},
    };
    const TEST: Limits = Limits {
        handshake: Duration::from_millis(800),
        pending: 2,
        clients: 2,
        burst: 5,
        window: Duration::from_millis(300),
    };
    /// A local test server whose sessions report on a channel and stay open until
    /// the client closes.
    fn server(limits: Limits) -> (u16, mpsc::Receiver<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = mpsc::channel();
        let tx = std::sync::Mutex::new(tx);
        std::thread::spawn(move || {
            serve(listener, "token-sintetico".into(), limits, move |mut s| {
                let _ = tx.lock().unwrap().send(());
                let _ = s.read(&mut [0; 1]);
            })
        });
        (port, rx)
    }
    fn connect(port: u16) -> TcpStream {
        TcpStream::connect(("127.0.0.1", port)).unwrap()
    }
    fn login(port: u16, token: &str) -> TcpStream {
        let mut s = connect(port);
        wire::write_frame(&mut s, &json!({ "token": token })).unwrap();
        s
    }
    /// True if the server closed the connection within `within`.
    fn closed(s: &mut TcpStream, within: Duration) -> bool {
        s.set_read_timeout(Some(within)).unwrap();
        match s.read(&mut [0; 1]) {
            Ok(n) => n == 0,
            Err(e) => !matches!(
                e.kind(),
                io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
            ),
        }
    }
    fn session_started(rx: &mpsc::Receiver<()>) -> bool {
        rx.recv_timeout(Duration::from_millis(500)).is_ok()
    }
    #[test]
    fn only_the_right_token_opens_a_session() {
        let (port, rx) = server(TEST);
        let mut wrong = login(port, "token-sbagliato");
        assert!(closed(&mut wrong, Duration::from_secs(2)));
        assert!(!session_started(&rx));
        let mut shorter = login(port, "token");
        assert!(closed(&mut shorter, Duration::from_secs(2)));
        let _right = login(port, "token-sintetico");
        assert!(session_started(&rx));
        assert!(same_token("abc", "abc") && !same_token("abc", "abd") && !same_token("ab", "abc"));
    }
    #[test]
    fn a_token_sent_drop_by_drop_runs_out_of_time() {
        let (port, rx) = server(TEST);
        let mut s = connect(port);
        let started = Instant::now();
        // A valid frame sent one byte at a time, too slowly to finish in time: each
        // read would succeed, only the overall deadline closes it.
        let mut frame = Vec::new();
        wire::write_frame(&mut frame, &json!({"token": "token-sintetico"})).unwrap();
        for b in frame {
            if s.write_all(&[b]).is_err() {
                break;
            }
            std::thread::sleep(Duration::from_millis(150));
            if started.elapsed() > Duration::from_secs(3) {
                break;
            }
        }
        assert!(closed(&mut s, Duration::from_secs(1)));
        assert!(started.elapsed() < Duration::from_secs(4));
        assert!(!session_started(&rx));
    }
    #[test]
    fn connections_beyond_the_pending_limit_are_closed_at_once() {
        let (port, _rx) = server(TEST);
        let mut first: Vec<_> = (0..TEST.pending).map(|_| connect(port)).collect();
        std::thread::sleep(Duration::from_millis(100));
        let mut extra = connect(port);
        assert!(closed(&mut extra, Duration::from_millis(300)));
        // The ones waiting within the limit are still open until their deadline.
        assert!(!closed(&mut first[0], Duration::from_millis(100)));
        for s in &mut first {
            assert!(closed(s, Duration::from_secs(2)));
        }
    }
    #[test]
    fn clients_beyond_the_limit_are_refused() {
        let (port, rx) = server(TEST);
        let kept: Vec<_> = (0..TEST.clients)
            .map(|_| login(port, "token-sintetico"))
            .collect();
        for _ in 0..TEST.clients {
            assert!(session_started(&rx));
        }
        let mut extra = login(port, "token-sintetico");
        assert!(closed(&mut extra, Duration::from_secs(1)));
        assert!(!session_started(&rx));
        // A slot frees up when a client leaves.
        drop(kept);
        std::thread::sleep(Duration::from_millis(200));
        let _again = login(port, "token-sintetico");
        assert!(session_started(&rx));
    }
    #[test]
    fn a_flood_of_messages_is_cut_and_the_window_resets() {
        let mut rate = Rate::new(TEST);
        assert!((0..TEST.burst).all(|_| rate.allow()));
        assert!(!rate.allow());
        std::thread::sleep(TEST.window);
        assert!(rate.allow());
    }
    #[cfg(windows)]
    #[test]
    fn the_token_file_is_readable_only_by_the_user_and_system() {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::{
            Foundation::LocalFree,
            Security::{
                Authorization::{
                    ConvertSecurityDescriptorToStringSecurityDescriptorW, GetNamedSecurityInfoW,
                    SDDL_REVISION_1, SE_FILE_OBJECT,
                },
                DACL_SECURITY_INFORMATION,
            },
        };
        let dir = std::env::temp_dir().join(format!("jesse-channel-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("connection.json");
        // An old file with the folder's permissions is replaced, not reused.
        std::fs::write(&path, b"vecchio").unwrap();
        write_private(&path, br#"{"token":"token-sintetico"}"#).unwrap();
        assert_eq!(
            std::fs::read(&path).unwrap(),
            br#"{"token":"token-sintetico"}"#
        );
        assert!(!path.with_extension("tmp").exists());
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain([0]).collect();
        let mut descriptor = std::ptr::null_mut();
        let mut text = std::ptr::null_mut();
        // SAFETY: test-only reads of the file's DACL; buffers freed with LocalFree.
        let sddl = unsafe {
            assert_eq!(
                GetNamedSecurityInfoW(
                    wide.as_ptr(),
                    SE_FILE_OBJECT,
                    DACL_SECURITY_INFORMATION,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    &mut descriptor,
                ),
                0
            );
            assert_ne!(
                ConvertSecurityDescriptorToStringSecurityDescriptorW(
                    descriptor,
                    SDDL_REVISION_1,
                    DACL_SECURITY_INFORMATION,
                    &mut text,
                    std::ptr::null_mut(),
                ),
                0
            );
            let len = (0..).take_while(|&i| *text.add(i) != 0).count();
            let s = String::from_utf16_lossy(std::slice::from_raw_parts(text, len));
            LocalFree(text.cast());
            LocalFree(descriptor);
            s
        };
        let sid = user_sid().unwrap();
        assert_eq!(sddl, format!("D:P(A;;FA;;;{sid})(A;;FA;;;SY)"));
        std::fs::remove_dir_all(dir).unwrap();
    }
}
