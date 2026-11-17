#[path = "../browser_protocol.rs"]
mod protocol;
use serde_json::{json, Value};
use std::{io, net::TcpStream, time::Duration};
fn connect() -> Result<TcpStream, Box<dyn std::error::Error>> {
    let descriptor: Value = serde_json::from_slice(&std::fs::read(
        protocol::directory().join("connection.json"),
    )?)?;
    let port = descriptor["port"]
        .as_u64()
        .filter(|p| *p > 0 && *p <= 65535)
        .ok_or("Invalid port")?;
    let mut socket = TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse()?,
        Duration::from_secs(2),
    )?;
    protocol::write_frame(&mut socket, &json!({"token":descriptor["token"]}))?;
    Ok(socket)
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let chrome = format!("chrome-extension://{}/", protocol::CHROMIUM_ID.trim());
    if !std::env::args()
        .skip(1)
        .any(|a| a == chrome || a == protocol::FIREFOX_ID)
    {
        return Err("Extension not allowed".into());
    }
    let mut socket = connect()?;
    let mut output_socket = socket.try_clone()?;
    std::thread::spawn(move || {
        let mut stdin = io::stdin().lock();
        while let Ok(message) = protocol::read_frame(&mut stdin) {
            if protocol::write_frame(&mut output_socket, &message).is_err() {
                break;
            }
        }
        let _ = output_socket.shutdown(std::net::Shutdown::Both);
    });
    let mut stdout = io::stdout().lock();
    while let Ok(message) = protocol::read_frame(&mut socket) {
        protocol::write_frame(&mut stdout, &message)?;
    }
    Ok(())
}
fn main() {
    if run().is_err() {
        let _ = protocol::write_frame(
            &mut io::stdout(),
            &json!({"kind":"error","message":"Collegamento a JesseArchive non disponibile. Apri l'app e verifica l'integrazione nelle Impostazioni."}),
        );
    }
}
