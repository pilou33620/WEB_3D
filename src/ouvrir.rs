//! Ouvrir un fichier STEP de ce poste dans WEB_3D, depuis le gestionnaire de fichiers.
//!
//!     web_3d ouvrir piece.step     copie le fichier, démarre WEB_3D s'il le faut, ouvre la page
//!     web_3d ouvrir --associer     ajoute « Ouvrir avec WEB_3D » aux .step/.stp (cet utilisateur)
//!
//! Le fichier est copié dans ~/.web_tools/ouvrir/ (servi au seul poste par le serveur, route
//! /ouvrir/) et seulement affiché : le bouton « Ranger » de la page le garde dans PROJETS.
//! Un WEB_3D déjà ouvert sert tel quel ; sinon il démarre par le lanceur de WEB_SUITE quand
//! WEB_3D en fait partie (../demarrer_WEB_SUITE), seul sinon, dans sa propre fenêtre.

use std::fs;
use std::io::{self, IsTerminal, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(not(windows))]
use std::process::Stdio;
use std::time::{Duration, Instant, SystemTime};

use serde_json::{json, Value};
use web_tools_commun::appairage::dossier_personnel;

const EXTENSIONS: [&str; 2] = [".step", ".stp"];
const PORT_LANCEUR: u16 = 8100; // les défauts ; chacun prend le suivant si occupé
const PORT_3D: u16 = 8139;
const GARDE_COPIES: u64 = 24 * 3600; // s : les copies plus vieilles sont retirées

pub fn dossier() -> PathBuf {
    dossier_personnel().join(".web_tools").join("ouvrir")
}

/// os.path.splitext : l'extension commence au dernier point, sauf en tête du nom.
fn couper_extension(nom: &str) -> (&str, &str) {
    match nom.rfind('.') {
        Some(i) if !nom[..i].chars().all(|c| c == '.') => nom.split_at(i),
        _ => (nom, ""),
    }
}

/// Le nom que le serveur accepte (NOM_PROJET de serveur_3d.rs) et que ?modele= ne coupe pas
/// (la virgule y sépare les fichiers).
fn nom_sur(chemin: &Path) -> String {
    let nom = chemin.file_name().unwrap_or_default().to_string_lossy();
    let (base, ext) = couper_extension(&nom);
    let base = regex::Regex::new(r"[^\w .()+-]").unwrap().replace_all(base, "_");
    let base = if base.trim().is_empty() { "modele" } else { base.trim() };
    let tete = regex::Regex::new(r"^[\w(]").unwrap().is_match(base);
    format!("{}{}{}", if tete { "" } else { "_" }, base, ext.to_lowercase())
}

fn copier(source: &Path, dossier: &Path) -> io::Result<String> {
    fs::create_dir_all(dossier)?;
    #[cfg(unix)]
    if fs::read_dir(dossier)?.next().is_none() {
        // créé à l'instant : à ce seul utilisateur, comme makedirs(mode=0o700)
        fs::set_permissions(dossier, std::os::unix::fs::PermissionsExt::from_mode(0o700))?;
    }
    for ancien in fs::read_dir(dossier)?.flatten() {
        let Ok(st) = ancien.metadata() else { continue }; // sans suivre les liens
        if st.is_file() && st.modified().ok().and_then(|t| SystemTime::now().duration_since(t).ok()).is_some_and(|age| age.as_secs() > GARDE_COPIES) {
            fs::remove_file(ancien.path())?;
        }
    }
    let nom = nom_sur(source);
    let cible = dossier.join(&nom);
    let partiel = dossier.join(format!("{}.part", nom));
    fs::copy(source, &partiel)?; // .part n'est jamais servi : pas de fichier à moitié lu
    fs::rename(&partiel, &cible)?;
    Ok(nom)
}

/// Une requête JSON à un serveur de ce poste. 127.0.0.1 en direct : jamais par un proxy.
fn lire(port: u16, chemin: &str, corps: Option<&Value>, delai: u64) -> io::Result<Value> {
    let delai = Duration::from_secs(delai);
    let mut s = TcpStream::connect_timeout(&SocketAddr::from(([127, 0, 0, 1], port)), delai)?;
    s.set_read_timeout(Some(delai))?;
    s.set_write_timeout(Some(delai))?;
    let texte = corps.map(Value::to_string).unwrap_or_default();
    write!(
        s,
        "{} {} HTTP/1.0\r\nHost: 127.0.0.1:{}\r\nX-WebSuite: 1\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
        if corps.is_some() { "POST" } else { "GET" },
        chemin,
        port,
        texte.len(),
        texte
    )?;
    let mut tout = Vec::new();
    s.read_to_end(&mut tout)?;
    let reponse = String::from_utf8_lossy(&tout);
    let invalide = |texte: String| io::Error::new(io::ErrorKind::InvalidData, texte);
    let (tete, suite) = reponse.split_once("\r\n\r\n").ok_or_else(|| invalide("réponse HTTP incomplète".into()))?;
    let statut = tete.lines().next().unwrap_or("");
    if !statut.split(' ').nth(1).is_some_and(|code| code.starts_with('2')) {
        return Err(io::Error::other(statut.to_string()));
    }
    serde_json::from_str(suite).map_err(|e| invalide(e.to_string()))
}

/// Le port, parmi les 10 que le serveur essaie, où `chemin` rend un JSON avec `cle`.
fn trouver(depart: u16, chemin: &str, cle: &str) -> Option<u16> {
    (depart..depart + 10).find(|port| lire(*port, chemin, None, 1).is_ok_and(|v| v.get(cle).is_some()))
}

/// Rappelle `test` jusqu'à ce qu'il rende quelque chose ; son Err arrête l'attente.
fn attendre<T>(test: impl Fn() -> Result<Option<T>, String>, delai: u64, quoi: &str) -> Result<T, String> {
    let fin = Instant::now() + Duration::from_secs(delai);
    while Instant::now() < fin {
        if let Some(r) = test()? {
            return Ok(r);
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    Err(format!("{} ne répond pas après {} s.", quoi, delai))
}

/// shlex.quote.
#[cfg(unix)]
fn guillemets_shell(s: &str) -> String {
    let simple = !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || "@%+=:,./-_".contains(c));
    if simple { s.to_string() } else { format!("'{}'", s.replace('\'', "'\"'\"'")) }
}

/// Lance un serveur par son script de démarrage (il met les exécutables à jour d'abord),
/// dans sa propre fenêtre : on y voit ses messages, la fermer l'arrête.
fn demarrer(script: &Path, args: &[&str]) -> io::Result<()> {
    let ici = script.parent().unwrap_or(Path::new("."));
    #[cfg(windows)]
    {
        // un .cmd : Rust le passe à cmd.exe, CREATE_NEW_CONSOLE lui donne sa fenêtre
        let mut cmd = Command::new(script);
        std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0000_0010);
        cmd.args(args).current_dir(ici).spawn()?;
    }
    #[cfg(unix)]
    {
        let script = script.to_string_lossy();
        let commande: Vec<&str> = ["sh", &script].into_iter().chain(args.iter().copied()).collect();
        let mut cmd = if crate::quel("x-terminal-emulator").is_some() {
            let mut c = Command::new("x-terminal-emulator");
            c.arg("-e").arg(commande.iter().map(|m| guillemets_shell(m)).collect::<Vec<_>>().join(" "));
            c
        } else {
            let mut c = Command::new(commande[0]);
            c.args(&commande[1..]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
            c
        };
        // sa propre session : fermer le gestionnaire de fichiers ne l'arrête pas
        unsafe {
            std::os::unix::process::CommandExt::pre_exec(&mut cmd, || {
                libc::setsid();
                Ok(())
            });
        }
        cmd.current_dir(ici).spawn()?;
    }
    Ok(())
}

fn script_de_demarrage(dossier: &Path, nom: &str) -> PathBuf {
    dossier.join(format!("demarrer_{}.{}", nom, if cfg!(windows) { "cmd" } else { "sh" }))
}

fn port_web3d() -> Result<u16, String> {
    let web3d = || trouver(PORT_3D, "/api/projets", "dispo");
    if let Some(port) = web3d() {
        return Ok(port);
    }
    let ici = crate::depot();
    let ici = std::path::absolute(&ici).unwrap_or(ici);
    let suite = script_de_demarrage(ici.parent().unwrap_or(Path::new(".")), "WEB_SUITE");
    let erreur = |e: io::Error| e.to_string();
    if !suite.is_file() {
        demarrer(&script_de_demarrage(&ici, "WEB_3D"), &["--sans-navigateur"]).map_err(erreur)?;
        return attendre(|| Ok(web3d()), 120, "WEB_3D");
    }
    let lanceur = || trouver(PORT_LANCEUR, "/api/etat", "outils");
    let lanceur = match lanceur() {
        Some(port) => port,
        None => {
            demarrer(&suite, &["--sans-navigateur"]).map_err(erreur)?;
            // le lanceur vérifie les mises à jour de la suite et des outils avant de répondre
            attendre(|| Ok(lanceur()), 180, "WEB_SUITE")?
        }
    };
    lire(lanceur, "/api/lancer", Some(&json!({"id": "web_3d"})), 120).map_err(erreur)?;
    let actif = || {
        let Ok(etat) = lire(lanceur, "/api/etat", None, 3) else { return Ok(None) };
        let vide = Vec::new();
        let Some(o) = etat["outils"].as_array().unwrap_or(&vide).iter().find(|o| o["id"] == "web_3d") else { return Ok(None) };
        if o["phase"] == "erreur" {
            return Err(format!("WEB_3D : {}", o["message"].as_str().unwrap_or("")));
        }
        Ok(o["port"].as_u64().filter(|p| o["phase"] == "actif" && *p > 0).map(|p| p as u16))
    };
    attendre(actif, 120, "WEB_3D")
}

#[cfg(windows)]
mod registre {
    use std::io;
    use windows_sys::Win32::System::Registry::{RegGetValueW, RegSetKeyValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};

    pub fn large(texte: &str) -> Vec<u16> {
        texte.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// La valeur par défaut (REG_SZ) d'une clé de cet utilisateur.
    pub fn lire(cle: &str) -> Option<String> {
        let mut tampon = vec![0u16; 4096];
        let mut octets = (tampon.len() * 2) as u32;
        let code = unsafe {
            RegGetValueW(HKEY_CURRENT_USER, large(cle).as_ptr(), std::ptr::null(), RRF_RT_REG_SZ, std::ptr::null_mut(), tampon.as_mut_ptr().cast(), &mut octets)
        };
        if code != 0 {
            return None;
        }
        let lus = &tampon[..(octets as usize / 2).min(tampon.len())];
        Some(String::from_utf16_lossy(lus.split(|c| *c == 0).next().unwrap_or(&[])))
    }

    /// Écrit une valeur (`nom` None : la valeur par défaut), en créant la clé s'il le faut.
    pub fn ecrire(cle: &str, nom: Option<&str>, genre: u32, donnees: &[u16]) -> io::Result<()> {
        let nom = nom.map(large);
        let code = unsafe {
            RegSetKeyValueW(
                HKEY_CURRENT_USER,
                large(cle).as_ptr(),
                nom.as_ref().map_or(std::ptr::null(), |n| n.as_ptr()),
                genre,
                donnees.as_ptr().cast(),
                (donnees.len() * 2) as u32,
            )
        };
        if code == 0 { Ok(()) } else { Err(io::Error::from_raw_os_error(code as i32)) }
    }
}

/// Inscrit « Ouvrir avec WEB_3D » pour cet utilisateur. forcer=false (démarrage du serveur) :
/// seulement si l'inscription manque ou pointe ailleurs (dossier déplacé) ; rend alors None si
/// rien n'était à faire, et un choix d'application fait ensuite à la main reste respecté.
/// L'association lance cet exécutable-ci : « web_3d ouvrir fichier ».
pub fn associer(forcer: bool) -> io::Result<Option<String>> {
    let exe = std::env::current_exe()?;
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Registry::{REG_NONE, REG_SZ};
        use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
        let commande = format!("\"{}\" ouvrir \"%1\"", exe.display());
        if !forcer && registre::lire(r"Software\Classes\WEB3D.step\shell\open\command").as_deref() == Some(commande.as_str()) {
            return Ok(None);
        }
        registre::ecrire(r"Software\Classes\WEB3D.step", None, REG_SZ, &registre::large("Modèle STEP (WEB_3D)"))?;
        registre::ecrire(r"Software\Classes\WEB3D.step\shell\open\command", None, REG_SZ, &registre::large(&commande))?;
        for ext in EXTENSIONS {
            registre::ecrire(&format!(r"Software\Classes\{}\OpenWithProgids", ext), Some("WEB3D.step"), REG_NONE, &[])?;
        }
        unsafe { SHChangeNotify(SHCNE_ASSOCCHANGED as _, SHCNF_IDLIST, std::ptr::null(), std::ptr::null()) };
        Ok(Some(
            "Clic droit sur un .step → Ouvrir avec → « Choisir une autre application » → WEB_3D, puis « Toujours » pour le double-clic."
                .to_string(),
        ))
    }
    #[cfg(not(windows))]
    {
        let partage = dossier_personnel().join(".local").join("share");
        // Exec= du format .desktop
        let guillemets = |p: &Path| {
            let mut s = String::from("\"");
            for c in p.to_string_lossy().chars() {
                if "\"`$\\".contains(c) {
                    s.push('\\');
                }
                s.push(c);
            }
            s + "\""
        };
        let entree = partage.join("applications").join("web3d-ouvrir.desktop");
        let contenu = format!(
            "[Desktop Entry]\nType=Application\nName=WEB_3D\nComment=Voir le modèle dans WEB_3D\n\
             Exec={} ouvrir %f\nMimeType=model/step;\nTerminal=false\nNoDisplay=true\n",
            guillemets(&exe)
        );
        if !forcer && fs::read_to_string(&entree).is_ok_and(|actuel| actuel == contenu) {
            return Ok(None);
        }
        fs::create_dir_all(partage.join("mime").join("packages"))?;
        fs::create_dir_all(partage.join("applications"))?;
        fs::write(
            partage.join("mime").join("packages").join("web3d-step.xml"),
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <mime-info xmlns=\"http://www.freedesktop.org/standards/shared-mime-info\">\n\
             \x20 <mime-type type=\"model/step\"><comment>Modèle STEP</comment>\
             <glob pattern=\"*.step\"/><glob pattern=\"*.stp\"/></mime-type>\n</mime-info>\n",
        )?;
        fs::write(&entree, contenu)?;
        let (mime, applications) = (partage.join("mime"), partage.join("applications"));
        let commandes: [(&str, Vec<&std::ffi::OsStr>); 3] = [
            ("update-mime-database", vec![mime.as_os_str()]),
            ("update-desktop-database", vec![applications.as_os_str()]),
            ("xdg-mime", vec!["default".as_ref(), "web3d-ouvrir.desktop".as_ref(), "model/step".as_ref()]),
        ];
        for (nom, args) in commandes {
            if crate::quel(nom).is_some() {
                // shortcut: pas de délai de 60 s comme en Python, ces commandes rendent la main aussitôt
                let _ = Command::new(nom).args(args).stdin(Stdio::null()).status();
            }
        }
        Ok(Some("Les .step et .stp s'ouvrent maintenant dans WEB_3D (double-clic ou Ouvrir avec).".to_string()))
    }
}

/// Lancé par le gestionnaire de fichiers, sans terminal : le message passe par une fenêtre
/// (celle du système : MessageBox sous Windows, zenity, kdialog ou xmessage ailleurs).
fn dire(texte: &str) {
    println!("{}", texte);
    let _ = io::stdout().flush();
    // Sous Windows l'association ouvre une console, qui se referme avec nous
    if io::stdout().is_terminal() && !crate::lance_par_double_clic() {
        return;
    }
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK};
        MessageBoxW(std::ptr::null_mut(), registre::large(texte).as_ptr(), registre::large("WEB_3D").as_ptr(), MB_OK | MB_ICONINFORMATION);
    }
    #[cfg(not(windows))]
    {
        let script = format!("display dialog {:?} with title \"WEB_3D\" buttons {{\"OK\"}}", texte);
        let fenetres: [(&str, Vec<&str>); 4] = [
            ("osascript", vec!["-e", &script]),
            ("zenity", vec!["--info", "--title=WEB_3D", "--text", texte]),
            ("kdialog", vec!["--title", "WEB_3D", "--msgbox", texte]),
            ("xmessage", vec!["-center", texte]),
        ];
        // pas de fenêtre ni d'écran : le message reste dans la sortie
        if let Some((nom, args)) = fenetres.iter().find(|(nom, _)| crate::quel(nom).is_some()) {
            let _ = Command::new(nom).args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status();
        }
    }
}

/// urllib.parse.quote : tout sauf les lettres, les chiffres et « _.-~/ ».
fn encoder_chemin(s: &str) -> String {
    s.bytes()
        .map(|c| if c.is_ascii_alphanumeric() || b"_.-~/".contains(&c) { (c as char).to_string() } else { format!("%{:02X}", c) })
        .collect()
}

pub fn principal(argv: &[String]) -> i32 {
    if argv == ["--associer"] {
        return match associer(true) {
            Ok(texte) => {
                dire(&texte.unwrap_or_default());
                0
            }
            Err(e) => {
                dire(&format!("Impossible d'ouvrir dans WEB_3D : {}", e));
                1
            }
        };
    }
    let source = Path::new(argv.first().map_or("", String::as_str));
    if argv.len() != 1 || !EXTENSIONS.iter().any(|e| argv[0].to_lowercase().ends_with(e)) || !source.is_file() {
        dire("Usage : web_3d ouvrir fichier.step (ou .stp) | --associer");
        return 2;
    }
    match copier(source, &dossier()).map_err(|e| e.to_string()).and_then(|nom| Ok((nom, port_web3d()?))) {
        Ok((nom, port)) => {
            crate::ouvrir_navigateur(&format!("http://127.0.0.1:{}/?modele={}", port, encoder_chemin(&format!("/ouvrir/{}", nom))));
            0
        }
        Err(e) => {
            dire(&format!("Impossible d'ouvrir dans WEB_3D : {}", e));
            1
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;

    #[test]
    fn noms_surs() {
        let noms: Vec<String> = ["/a/x,y&z.STEP", ".cache.stp", "été 1+1.stp", "/a/ .stp", "sans"].iter().map(|n| nom_sur(Path::new(n))).collect();
        assert_eq!(noms, ["x_y_z.step", "_.cache.stp", "été 1+1.stp", "modele.stp", "sans"]);
        for n in &noms[..4] {
            assert!(crate::serveur_3d::NOM_PROJET.is_match(n), "{}", n);
        }
        assert_eq!(encoder_chemin("/ouvrir/Pièce_ v2.step"), "/ouvrir/Pi%C3%A8ce_%20v2.step");
        #[cfg(unix)]
        assert_eq!(guillemets_shell("/a b/c'd.sh"), "'/a b/c'\"'\"'d.sh'");
    }

    /// La copie arrive entière sous son nom sûr, les copies de plus d'un jour sont retirées.
    #[test]
    fn copie_et_vieilles_copies() {
        let tmp = std::env::temp_dir().join(format!("web3d-ouvrir-{}", std::process::id()));
        let dossier = tmp.join("ouvrir");
        fs::create_dir_all(&dossier).unwrap();
        let source = tmp.join("Pièce, v2.STEP");
        fs::write(&source, b"ISO-10303-21;").unwrap();
        let vieux = fs::File::create(dossier.join("vieux.stp")).unwrap();
        vieux.set_modified(SystemTime::UNIX_EPOCH).unwrap();
        fs::write(dossier.join("recent.stp"), b"x").unwrap();
        assert_eq!(copier(&source, &dossier).unwrap(), "Pièce_ v2.step");
        let mut restent: Vec<String> = fs::read_dir(&dossier).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
        restent.sort();
        assert_eq!(restent, ["Pièce_ v2.step", "recent.stp"]);
        assert_eq!(fs::read(dossier.join("Pièce_ v2.step")).unwrap(), b"ISO-10303-21;");
        fs::remove_dir_all(&tmp).unwrap();
    }
}
