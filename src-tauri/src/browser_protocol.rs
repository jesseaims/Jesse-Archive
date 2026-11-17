use serde_json::Value;
use std::io::{self, Read, Write};
pub const HOST: &str = "com.jessearchive.browser";
pub const FIREFOX_ID: &str = "browser@jessearchive.local";
pub const CHROMIUM_ID: &str = include_str!("../../browser-extension/chromium-id.txt");
pub fn directory() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var_os("APPDATA").unwrap_or_default())
        .join("JesseArchive")
        .join("browser")
}
pub fn read_frame(reader: &mut impl Read) -> io::Result<Value> {
    let mut length = [0; 4];
    reader.read_exact(&mut length)?;
    let length = u32::from_le_bytes(length) as usize;
    if length == 0 || length > 262144 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid message length",
        ));
    }
    let mut bytes = vec![0; length];
    reader.read_exact(&mut bytes)?;
    serde_json::from_slice(&bytes).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}
pub fn write_frame(writer: &mut impl Write, value: &Value) -> io::Result<()> {
    let bytes = serde_json::to_vec(value)?;
    if bytes.len() > 262144 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Message too large",
        ));
    }
    writer.write_all(&(bytes.len() as u32).to_le_bytes())?;
    writer.write_all(&bytes)?;
    writer.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn framing_and_limits() {
        let expected = serde_json::json!({"kind":"fill","username":"à日本語"});
        let mut bytes = Vec::new();
        write_frame(&mut bytes, &expected).unwrap();
        assert_eq!(read_frame(&mut bytes.as_slice()).unwrap(), expected);
        assert!(read_frame(&mut u32::MAX.to_le_bytes().as_slice()).is_err());
        assert!(read_frame(&mut [0, 0, 0, 0].as_slice()).is_err());
    }
}
