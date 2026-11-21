//! Readers for the exports of other password managers and browsers. Each one turns a
//! file into plain `Entry` records; `core.rs` adds them to the vault (folders, password
//! history, groups) in one transaction. Nothing here touches the vault or the disk.
//!
//! - CSV: column names of the most common programs, with an optional column mapping
//!   chosen by the user in the import preview (unknown programs).
//! - Bitwarden JSON (unencrypted export).
//! - KeePass 2 / KeePassXC XML export.
use serde_json::{json, Value as V};
use std::collections::HashMap;

/// One imported record before it becomes a vault item.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Entry {
    /// Vault item type: login, note, card, personal, crypto, passkey.
    pub kind: String,
    pub title: String,
    pub folder: String,
    pub fav: bool,
    /// Structured fields (url, username, password, totp, holder, number…).
    pub fields: HashMap<String, String>,
    pub notes: String,
    /// Group of an account without a website (an app or another service), by name:
    /// Jesse's Archive CSV columns `app_group` / `app_group_type`.
    pub group: String,
    /// "app" or "other".
    pub group_kind: String,
}

/// Where a CSV column goes. `notes+` appends "Column: value" to the notes.
pub const TARGETS: &[&str] = &[
    "title",
    "url",
    "username",
    "password",
    "notes",
    "totp",
    "folder",
    "fav",
    "type",
    "email",
    "holder",
    "number",
    "cvv",
    "expiry",
    "pin",
    "fullname",
    "phone",
    "address",
    "city",
    "zip",
    "country",
    "birthday",
    "platform",
    "seed",
    "credential",
    "app_group",
    "app_group_type",
    "notes+",
    "ignore",
];

fn norm(header: &str) -> String {
    header
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}

/// Field of a CSV column name as written by the common password managers.
pub fn csv_target(header: &str) -> &'static str {
    match norm(header).as_str() {
        "name" | "title" | "account" | "accountname" | "entryname" | "itemname" | "sitename" => {
            "title"
        }
        "url" | "website" | "loginuri" | "uri" | "loginurl" | "weburl" | "hostname" | "site" => {
            "url"
        }
        "username" | "loginusername" | "user" | "login" | "userid" => "username",
        "password" | "loginpassword" | "pwd" | "pass" | "passwd" => "password",
        "notes" | "note" | "extra" | "comment" | "comments" => "notes",
        "totp" | "logintotp" | "otp" | "otpauth" | "otpsecret" | "otpurl" | "authenticatorkey"
        | "twofactorsecret" => "totp",
        "folder" | "grouping" | "group" | "vault" | "category" => "folder",
        "favorite" | "fav" | "favourite" | "starred" => "fav",
        "type" | "itemtype" => "type",
        "email" | "emailaddress" => "email",
        "cardholdername" | "holder" | "nameoncard" | "cardholder" => "holder",
        "cardnumber" | "number" => "number",
        "cvc" | "cvv" | "securitycode" => "cvv",
        "expirydate" | "expiry" | "expiration" | "expirationdate" => "expiry",
        "pin" => "pin",
        "fullname" => "fullname",
        "phone" | "phonenumber" => "phone",
        "address" | "address1" | "street" => "address",
        "city" => "city",
        "zip" | "zipcode" | "postalcode" => "zip",
        "country" => "country",
        "birthday" | "birthdate" | "dateofbirth" => "birthday",
        "platform" => "platform",
        "seed" => "seed",
        "credential" => "credential",
        "appgroup" => "app_group",
        "appgrouptype" => "app_group_type",
        _ => "ignore",
    }
}

/// Program that produced a CSV, recognized from its columns.
pub fn csv_source(headers: &[String]) -> &'static str {
    let h: Vec<String> = headers.iter().map(|x| norm(x)).collect();
    let has = |k: &str| h.iter().any(|x| x == k);
    if has("loginuri") && has("loginusername") {
        "Bitwarden"
    } else if has("grouping") && has("extra") {
        "LastPass"
    } else if has("otpauth") && has("archived") {
        "1Password"
    } else if has("otpauth") && has("title") {
        "Password di Apple / Safari"
    } else if has("httprealm") || has("formactionorigin") {
        "Firefox"
    } else if has("username2") || (has("otpsecret") && has("category")) || has("otpurl") {
        "Dashlane"
    } else if has("additionalurls") || (has("cardholdername") && has("fullname")) {
        "NordPass"
    } else if has("createtime") && has("vault") {
        "Proton Pass"
    } else if has("group") && has("lastmodified") {
        "KeePassXC"
    } else if has("pwd") && has("matchurl") {
        "RoboForm"
    } else if has("name") && has("type") && has("folder") && has("username") && has("seed") {
        "Jesse's Archive"
    } else if h.len() <= 5 && has("name") && has("url") && has("username") && has("password") {
        "Chrome / Edge / Brave / Opera"
    } else {
        "CSV"
    }
}

/// Columns of a CSV with the field each one goes to: the automatic choice, replaced by
/// `mapping` (column name → target) when the user changed it in the preview.
pub fn csv_columns(
    text: &str,
    mapping: Option<&HashMap<String, String>>,
) -> Result<Vec<(String, String)>, String> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(text.as_bytes());
    let headers = rdr.headers().map_err(|e| e.to_string())?.clone();
    Ok(headers
        .iter()
        .map(|h| {
            let auto = csv_target(h).to_string();
            let target = mapping
                .and_then(|m| m.get(h))
                .filter(|t| TARGETS.contains(&t.as_str()))
                .cloned()
                .unwrap_or(auto);
            (h.to_string(), target)
        })
        .collect())
}

fn host_of(url: &str) -> String {
    let candidate = if url.contains("://") {
        url.to_string()
    } else {
        format!("https://{url}")
    };
    url::Url::parse(&candidate)
        .ok()
        .and_then(|u| {
            u.host_str()
                .map(|h| h.trim_start_matches("www.").to_string())
        })
        .unwrap_or_default()
}
fn truthy(v: &str) -> bool {
    matches!(
        v.trim().to_lowercase().as_str(),
        "1" | "true" | "yes" | "y" | "si" | "sì" | "x"
    )
}
fn kind_of(raw: &str, fields: &HashMap<String, String>) -> String {
    let t = norm(raw);
    match t.as_str() {
        "login" | "password" | "website" | "" => {
            if t.is_empty() && fields.contains_key("number") {
                "card".into()
            } else {
                "login".into()
            }
        }
        "note" | "securenote" | "notes" => "note".into(),
        "card" | "creditcard" | "paymentcard" => "card".into(),
        "identity" | "personal" | "personalinfo" => "personal".into(),
        "crypto" | "passkey" => t,
        _ => "login".into(),
    }
}

/// Reads a CSV with the given column targets (see `csv_columns`).
pub fn parse_csv(text: &str, columns: &[(String, String)]) -> Result<Vec<Entry>, String> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(text.as_bytes());
    rdr.headers().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rdr.records() {
        let row = row.map_err(|e| e.to_string())?;
        let mut fields: HashMap<String, String> = HashMap::new();
        let mut extra: Vec<String> = Vec::new();
        let (mut title, mut folder, mut fav, mut kind, mut notes) = (
            String::new(),
            String::new(),
            false,
            String::new(),
            Vec::new(),
        );
        let (mut group, mut group_kind) = (String::new(), String::new());
        for ((header, target), value) in columns.iter().zip(row.iter()) {
            let value = value.trim();
            if value.is_empty() {
                continue;
            }
            match target.as_str() {
                "ignore" => {}
                "title" if title.is_empty() => title = value.into(),
                "folder" if folder.is_empty() => folder = value.into(),
                "fav" => fav |= truthy(value),
                "type" => kind = value.into(),
                "app_group" => group = value.into(),
                "app_group_type" => group_kind = value.into(),
                "notes" => notes.push(value.to_string()),
                "notes+" => extra.push(format!("{header}: {value}")),
                "title" | "folder" => extra.push(format!("{header}: {value}")),
                t => {
                    fields.entry(t.to_string()).or_insert_with(|| value.into());
                }
            }
        }
        notes.extend(extra);
        let kind = kind_of(&kind, &fields);
        // Logins identified by email only (Proton Pass, NordPass, Dashlane).
        if kind == "login" && !fields.contains_key("username") {
            if let Some(email) = fields.get("email").cloned() {
                fields.insert("username".into(), email);
            }
        }
        if title.is_empty() {
            title = fields
                .get("url")
                .map(|u| host_of(u))
                .filter(|h| !h.is_empty())
                .or_else(|| fields.get("username").cloned())
                .unwrap_or_default();
        }
        if title.is_empty() {
            continue;
        }
        out.push(Entry {
            kind,
            title,
            folder,
            fav,
            fields,
            notes: notes.join("\n"),
            group,
            group_kind,
        });
    }
    Ok(out)
}

/// Whether a JSON payload is a Bitwarden export (numeric item types, `login` objects
/// or the `encrypted` flag), not Jesse's Archive's own format.
pub fn is_bitwarden(v: &V) -> bool {
    v.get("encrypted").is_some_and(V::is_boolean)
        || v["items"].as_array().is_some_and(|items| {
            items
                .iter()
                .any(|i| i["type"].is_u64() || i.get("login").is_some_and(V::is_object))
        })
}

fn text(v: &V) -> String {
    v.as_str().unwrap_or_default().trim().to_string()
}

/// Bitwarden JSON export (unencrypted): logins, secure notes, cards and identities.
pub fn parse_bitwarden(v: &V) -> Result<Vec<Entry>, String> {
    if v["encrypted"] == true {
        return Err(
            "Export di Bitwarden cifrato: esportalo in formato JSON non cifrato oppure CSV".into(),
        );
    }
    let folders: HashMap<String, String> = v["folders"]
        .as_array()
        .map(|list| {
            list.iter()
                .map(|f| (text(&f["id"]), text(&f["name"])))
                .collect()
        })
        .unwrap_or_default();
    let mut out = Vec::new();
    for item in v["items"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
        let mut e = Entry {
            title: text(&item["name"]),
            folder: folders
                .get(&text(&item["folderId"]))
                .cloned()
                .unwrap_or_default(),
            fav: item["favorite"] == true,
            ..Default::default()
        };
        let mut notes = vec![text(&item["notes"])];
        let mut put = |k: &str, value: String| {
            if !value.is_empty() {
                e.fields.insert(k.into(), value);
            }
        };
        match item["type"].as_u64() {
            Some(1) => {
                e.kind = "login".into();
                let login = &item["login"];
                let uris: Vec<String> = login["uris"]
                    .as_array()
                    .map(|u| {
                        u.iter()
                            .map(|x| text(&x["uri"]))
                            .filter(|x| !x.is_empty())
                            .collect()
                    })
                    .unwrap_or_default();
                put("url", uris.first().cloned().unwrap_or_default());
                put("username", text(&login["username"]));
                put("password", text(&login["password"]));
                put("totp", text(&login["totp"]));
                if uris.len() > 1 {
                    notes.push(format!("Altri indirizzi: {}", uris[1..].join(", ")));
                }
                if login["fido2Credentials"]
                    .as_array()
                    .is_some_and(|f| !f.is_empty())
                {
                    notes.push("Passkey di Bitwarden non importata.".into());
                }
            }
            Some(2) => e.kind = "note".into(),
            Some(3) => {
                e.kind = "card".into();
                let card = &item["card"];
                put("holder", text(&card["cardholderName"]));
                put("number", text(&card["number"]));
                put("cvv", text(&card["code"]));
                let (m, y) = (text(&card["expMonth"]), text(&card["expYear"]));
                if !m.is_empty() || !y.is_empty() {
                    put(
                        "expiry",
                        format!("{m:0>2}/{y}").trim_matches('/').to_string(),
                    );
                }
            }
            Some(4) => {
                e.kind = "personal".into();
                let id = &item["identity"];
                let name = ["firstName", "middleName", "lastName"]
                    .iter()
                    .map(|k| text(&id[*k]))
                    .filter(|x| !x.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");
                put("fullname", name);
                put("email", text(&id["email"]));
                put("phone", text(&id["phone"]));
                let address = ["address1", "address2", "address3"]
                    .iter()
                    .map(|k| text(&id[*k]))
                    .filter(|x| !x.is_empty())
                    .collect::<Vec<_>>()
                    .join(", ");
                put("address", address);
                put("city", text(&id["city"]));
                put("zip", text(&id["postalCode"]));
                put("country", text(&id["country"]));
                for (label, k) in [
                    ("Username", "username"),
                    ("Azienda", "company"),
                    ("Codice fiscale / SSN", "ssn"),
                    ("Passaporto", "passportNumber"),
                    ("Patente", "licenseNumber"),
                ] {
                    let value = text(&id[k]);
                    if !value.is_empty() {
                        notes.push(format!("{label}: {value}"));
                    }
                }
            }
            // SSH keys and future types: kept as notes rather than lost.
            _ => e.kind = "note".into(),
        }
        for f in item["fields"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
            let (name, value) = (text(&f["name"]), text(&f["value"]));
            if !value.is_empty() {
                notes.push(if name.is_empty() {
                    value
                } else {
                    format!("{name}: {value}")
                });
            }
        }
        e.notes = notes
            .into_iter()
            .filter(|n| !n.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        if e.title.is_empty() {
            e.title = e
                .fields
                .get("url")
                .map(|u| host_of(u))
                .filter(|h| !h.is_empty())
                .or_else(|| e.fields.get("username").cloned())
                .unwrap_or_default();
        }
        if !e.title.is_empty() {
            out.push(e);
        }
    }
    Ok(out)
}

/// Whether the text is a KeePass 2 / KeePassXC XML export.
pub fn is_keepass(text: &str) -> bool {
    let head: String = text.trim_start().chars().take(400).collect();
    head.starts_with('<') && head.contains("<KeePassFile")
}

/// KeePass 2 / KeePassXC XML export. Each group below the database root becomes a
/// folder (nested ones as "Parent / Child"); the recycle bin and entry histories are
/// skipped; custom fields go into the notes.
pub fn parse_keepass(text: &str) -> Result<Vec<Entry>, String> {
    let options = roxmltree::ParsingOptions {
        allow_dtd: false,
        ..Default::default()
    };
    let doc = roxmltree::Document::parse_with_options(text, options)
        .map_err(|_| "File XML di KeePass non valido".to_string())?;
    fn child<'a, 'i>(n: roxmltree::Node<'a, 'i>, name: &str) -> Option<roxmltree::Node<'a, 'i>> {
        n.children().find(|c| c.has_tag_name(name))
    }
    let value = |n: roxmltree::Node| n.text().unwrap_or_default().trim().to_string();
    let root = doc.root_element();
    let bin = child(root, "Meta")
        .and_then(|m| child(m, "RecycleBinUUID"))
        .map(value)
        .unwrap_or_default();
    let top = child(root, "Root")
        .and_then(|r| child(r, "Group"))
        .ok_or("File XML di KeePass non valido")?;
    let mut out = Vec::new();
    // (group, folder path); the top group is the database itself, not a folder.
    let mut stack = vec![(top, String::new())];
    while let Some((group, path)) = stack.pop() {
        for node in group.children().filter(|n| n.is_element()) {
            if node.has_tag_name("Group") {
                let uuid = child(node, "UUID").map(value).unwrap_or_default();
                if !bin.is_empty() && uuid == bin {
                    continue;
                }
                let name = child(node, "Name").map(value).unwrap_or_default();
                let sub = match (path.is_empty(), name.is_empty()) {
                    (_, true) => path.clone(),
                    (true, false) => name,
                    (false, false) => format!("{path} / {name}"),
                };
                stack.push((node, sub));
            } else if node.has_tag_name("Entry") {
                let mut e = Entry {
                    kind: "login".into(),
                    folder: path.clone(),
                    ..Default::default()
                };
                let mut notes = Vec::new();
                let mut extra = Vec::new();
                for s in node.children().filter(|c| c.has_tag_name("String")) {
                    let key = child(s, "Key").map(value).unwrap_or_default();
                    let val = child(s, "Value").map(value).unwrap_or_default();
                    if val.is_empty() {
                        continue;
                    }
                    match key.as_str() {
                        "Title" => e.title = val,
                        "UserName" => {
                            e.fields.insert("username".into(), val);
                        }
                        "Password" => {
                            e.fields.insert("password".into(), val);
                        }
                        "URL" => {
                            e.fields.insert("url".into(), val);
                        }
                        "Notes" => notes.push(val),
                        // KeePassXC ("otp", otpauth URI) and KeePass 2.47+ (base32 secret).
                        "otp" | "TimeOtp-Secret-Base32" => {
                            e.fields.insert("totp".into(), val);
                        }
                        _ => extra.push(format!("{key}: {val}")),
                    }
                }
                notes.extend(extra);
                e.notes = notes.join("\n");
                if e.title.is_empty() {
                    e.title = e
                        .fields
                        .get("url")
                        .map(|u| host_of(u))
                        .filter(|h| !h.is_empty())
                        .or_else(|| e.fields.get("username").cloned())
                        .unwrap_or_default();
                }
                if !e.title.is_empty() {
                    out.push(e);
                }
            }
        }
    }
    Ok(out)
}

/// What the preview shows for a CSV column: its field and a sample (never a password).
pub fn column_preview(text: &str, columns: &[(String, String)]) -> V {
    let mut samples: Vec<String> = vec![String::new(); columns.len()];
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(text.as_bytes());
    for row in rdr.records().flatten().take(50) {
        for (i, value) in row.iter().enumerate().take(columns.len()) {
            if samples[i].is_empty() && !value.trim().is_empty() {
                samples[i] = value.trim().chars().take(40).collect();
            }
        }
    }
    json!(columns
        .iter()
        .zip(samples)
        .map(|((header, target), sample)| {
            let secret = matches!(target.as_str(), "password" | "cvv" | "pin" | "seed" | "totp")
                || csv_target(header) == "password";
            json!({"header": header, "target": target, "sample": if secret { "••••".into() } else { sample }})
        })
        .collect::<Vec<_>>())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn csv(text: &str) -> Vec<Entry> {
        parse_csv(text, &csv_columns(text, None).unwrap()).unwrap()
    }
    fn heads(text: &str) -> Vec<String> {
        text.lines()
            .next()
            .unwrap()
            .split(',')
            .map(str::to_string)
            .collect()
    }

    #[test]
    fn csv_exports_of_common_programs() {
        // Synthetic samples with each program's documented column names.
        let samples = [
            ("folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\nSocial,1,login,Esempio,nota,,0,https://example.com,utente,pw,JBSWY3DP\n", "Bitwarden"),
            ("url,username,password,totp,extra,name,grouping,fav\nhttps://example.com,utente,pw,,nota,Esempio,Social,1\n", "LastPass"),
            ("Title,Url,Username,Password,OTPAuth,Favorite,Archived,Tags,Notes\nEsempio,https://example.com,utente,pw,,true,false,,nota\n", "1Password"),
            ("Title,URL,Username,Password,Notes,OTPAuth\nEsempio,https://example.com,utente,pw,nota,\n", "Password di Apple / Safari"),
            ("url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged\nhttps://www.example.com,utente,pw,,https://www.example.com,{x},1,2,3\n", "Firefox"),
            ("username,username2,username3,title,password,note,url,category,otpSecret\nutente,,,Esempio,pw,nota,https://example.com,Social,\n", "Dashlane"),
            ("name,url,additional_urls,username,password,note,cardholdername,cardnumber,cvc,pin,expirydate,zipcode,folder,full_name,phone_number,email,address1,address2,city,country,state,type\nEsempio,https://example.com,,utente,pw,nota,,,,,,,Social,,,,,,,,,password\n", "NordPass"),
            ("type,name,url,email,username,password,note,totp,createTime,modifyTime,vault\nlogin,Esempio,https://example.com,,utente,pw,nota,,1,2,Social\n", "Proton Pass"),
            ("\"Group\",\"Title\",\"Username\",\"Password\",\"URL\",\"Notes\",\"TOTP\",\"Icon\",\"Last Modified\",\"Created\"\n\"Root/Social\",\"Esempio\",\"utente\",\"pw\",\"https://example.com\",\"nota\",\"\",\"0\",\"x\",\"y\"\n", "KeePassXC"),
            ("Name,Url,MatchUrl,Login,Pwd,Note,Folder\nEsempio,https://example.com,https://example.com,utente,pw,nota,Social\n", "RoboForm"),
            ("name,url,username,password,note\nEsempio,https://example.com,utente,pw,nota\n", "Chrome / Edge / Brave / Opera"),
        ];
        for (text, source) in samples {
            let headers = csv::ReaderBuilder::new()
                .from_reader(text.as_bytes())
                .headers()
                .unwrap()
                .iter()
                .map(str::to_string)
                .collect::<Vec<_>>();
            assert_eq!(csv_source(&headers), source, "{text}");
            let e = &csv(text)[0];
            assert_eq!(e.kind, "login", "{source}");
            assert_eq!(e.fields["username"], "utente", "{source}");
            assert_eq!(e.fields["password"], "pw", "{source}");
            assert!(e.fields["url"].contains("example.com"), "{source}");
            // Firefox has no name column: the title is the site.
            let title = if source == "Firefox" {
                "example.com"
            } else {
                "Esempio"
            };
            assert_eq!(e.title, title, "{source}");
            if source != "Firefox" {
                assert_eq!(e.notes, "nota", "{source}");
            }
        }
        let bw = &csv(samples_first())[0];
        assert!(bw.fav);
        assert_eq!(bw.folder, "Social");
        assert_eq!(bw.fields["totp"], "JBSWY3DP");
    }
    fn samples_first() -> &'static str {
        "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\nSocial,1,login,Esempio,nota,,0,https://example.com,utente,pw,JBSWY3DP\n"
    }

    #[test]
    fn email_only_logins_cards_and_custom_mapping() {
        // Proton Pass with an email and no username.
        let e = &csv("type,name,url,email,username,password,note,totp,createTime,modifyTime,vault\nlogin,Posta,https://mail.example,io@example.com,,pw,,,1,2,Personale\n")[0];
        assert_eq!(e.fields["username"], "io@example.com");
        assert_eq!(e.folder, "Personale");
        // A card recognized by its number.
        let c = &csv("name,cardholdername,cardnumber,cvc,expirydate\nCarta,Mario,4111111111111111,123,12/30\n")[0];
        assert_eq!(c.kind, "card");
        assert_eq!(c.fields["number"], "4111111111111111");
        // Unknown program: the user maps the columns in the preview.
        let text = "Sito web,Chi,Segreto,Altro\nesempio.it,utente,pw,da ricordare\n";
        assert_eq!(csv_source(&heads(text)), "CSV");
        let mapping: HashMap<String, String> = [
            ("Sito web", "url"),
            ("Chi", "username"),
            ("Segreto", "password"),
            ("Altro", "notes+"),
        ]
        .into_iter()
        .map(|(a, b)| (a.to_string(), b.to_string()))
        .collect();
        let cols = csv_columns(text, Some(&mapping)).unwrap();
        let e = &parse_csv(text, &cols).unwrap()[0];
        assert_eq!(e.title, "esempio.it");
        assert_eq!(e.fields["password"], "pw");
        assert_eq!(e.notes, "Altro: da ricordare");
        // An invalid target from the UI falls back to the automatic choice.
        let bad: HashMap<String, String> = [("Segreto".to_string(), "evil".to_string())].into();
        assert_eq!(csv_columns(text, Some(&bad)).unwrap()[2].1, "ignore");
        // The preview never shows a password sample.
        let preview = column_preview(text, &cols);
        assert_eq!(preview[2]["sample"], "••••");
        assert_eq!(preview[1]["sample"], "utente");
    }

    #[test]
    fn bitwarden_json_export() {
        let v: V = serde_json::from_str(r#"{
          "encrypted": false,
          "folders": [{"id": "f1", "name": "Social"}],
          "items": [
            {"type": 1, "name": "Esempio", "notes": "nota", "favorite": true, "folderId": "f1",
             "fields": [{"name": "PIN", "value": "1234", "type": 1}],
             "login": {"uris": [{"uri": "https://example.com"}, {"uri": "https://example.org"}],
                       "username": "utente", "password": "pw", "totp": "JBSWY3DP"}},
            {"type": 2, "name": "Nota segreta", "notes": "testo"},
            {"type": 3, "name": "Carta", "card": {"cardholderName": "Mario", "number": "4111", "code": "123", "expMonth": "3", "expYear": "2030"}},
            {"type": 4, "name": "Io", "identity": {"firstName": "Mario", "lastName": "Rossi", "email": "m@example.com", "city": "Roma", "ssn": "X"}}
          ]}"#).unwrap();
        assert!(is_bitwarden(&v));
        let items = parse_bitwarden(&v).unwrap();
        assert_eq!(items.len(), 4);
        let login = &items[0];
        assert_eq!(
            (login.kind.as_str(), login.folder.as_str(), login.fav),
            ("login", "Social", true)
        );
        assert_eq!(login.fields["url"], "https://example.com");
        assert_eq!(login.fields["totp"], "JBSWY3DP");
        assert_eq!(
            login.notes,
            "nota\nAltri indirizzi: https://example.org\nPIN: 1234"
        );
        assert_eq!(items[1].kind, "note");
        assert_eq!(items[2].fields["expiry"], "03/2030");
        assert_eq!(items[3].fields["fullname"], "Mario Rossi");
        assert!(items[3].notes.contains("Codice fiscale / SSN: X"));
        let encrypted: V = serde_json::from_str(r#"{"encrypted": true, "items": []}"#).unwrap();
        assert!(is_bitwarden(&encrypted));
        assert!(parse_bitwarden(&encrypted).is_err());
        // Jesse's Archive's own export is not mistaken for Bitwarden.
        let own: V = serde_json::from_str(
            r#"{"kind":"jessamine-export","items":[{"id":"a","type":"login","title":"x","f":{}}]}"#,
        )
        .unwrap();
        assert!(!is_bitwarden(&own));
    }

    #[test]
    fn keepass_xml_export() {
        let xml = r#"<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<KeePassFile>
  <Meta><RecycleBinUUID>BIN</RecycleBinUUID></Meta>
  <Root>
    <Group>
      <UUID>ROOT</UUID><Name>Database</Name>
      <Entry>
        <String><Key>Title</Key><Value>Alla radice</Value></String>
        <String><Key>Password</Key><Value ProtectInMemory="True">pw0</Value></String>
      </Entry>
      <Group>
        <UUID>G1</UUID><Name>Email</Name>
        <Entry>
          <String><Key>Title</Key><Value>Posta</Value></String>
          <String><Key>UserName</Key><Value>utente</Value></String>
          <String><Key>Password</Key><Value ProtectInMemory="True">pw &amp; &lt;1&gt;</Value></String>
          <String><Key>URL</Key><Value>https://mail.example</Value></String>
          <String><Key>Notes</Key><Value>riga 1
riga 2</Value></String>
          <String><Key>otp</Key><Value>otpauth://totp/x?secret=JBSWY3DP</Value></String>
          <String><Key>Domanda</Key><Value>risposta</Value></String>
          <History><Entry><String><Key>Title</Key><Value>Vecchia versione</Value></String></Entry></History>
        </Entry>
        <Group>
          <UUID>G2</UUID><Name>Lavoro</Name>
          <Entry><String><Key>Title</Key><Value>Annidato</Value></String></Entry>
        </Group>
      </Group>
      <Group>
        <UUID>BIN</UUID><Name>Cestino</Name>
        <Entry><String><Key>Title</Key><Value>Eliminato</Value></String></Entry>
      </Group>
    </Group>
  </Root>
</KeePassFile>"#;
        assert!(is_keepass(xml));
        let items = parse_keepass(xml).unwrap();
        let titles: Vec<&str> = items.iter().map(|e| e.title.as_str()).collect();
        assert_eq!(titles.len(), 3, "{titles:?}");
        assert!(!titles.contains(&"Eliminato") && !titles.contains(&"Vecchia versione"));
        let mail = items.iter().find(|e| e.title == "Posta").unwrap();
        assert_eq!(mail.folder, "Email");
        assert_eq!(mail.fields["password"], "pw & <1>");
        assert_eq!(mail.fields["totp"], "otpauth://totp/x?secret=JBSWY3DP");
        assert_eq!(mail.notes, "riga 1\nriga 2\nDomanda: risposta");
        assert_eq!(
            items.iter().find(|e| e.title == "Annidato").unwrap().folder,
            "Email / Lavoro"
        );
        assert_eq!(
            items
                .iter()
                .find(|e| e.title == "Alla radice")
                .unwrap()
                .folder,
            ""
        );
        // DTDs (entity expansion) are refused.
        assert!(parse_keepass("<!DOCTYPE x [<!ENTITY a \"b\">]><KeePassFile/>").is_err());
        assert!(!is_keepass("name,url\n"));
    }
}
