//! Ce que le serveur sert et range : la page, ses fichiers, les projets.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{json, Value};
use web_tools_commun::appairage::{self, Garde};
use web_tools_commun::pilote::Pilote;
use web_tools_commun::serveur::{params, Reponse, Requete};

// Ce que la page charge : elle-même, css/, js/, vendor/, exemples/, et les
// fichiers 3D posés à côté (?modele=piece.stp). Rien d'autre du dossier ne sort
// — ni .git/, ni les sources, ni la liste des fichiers. Un segment ne commence
// jamais par un point : ni « .. », ni fichier caché.
pub static STATIQUE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        r"(?i)^/(?:index\.html|conception\.html|regles-conception\.md)?$",
        r"|^/(?:css|js|vendor|exemples)(?:/[\w-][\w.-]*)+$",
        r"|^(?:/[\w(][\w .()+-]*)+\.(?:stpz?|step|igs|iges|brep|brp|stl|3mf|obj|mtl|glb|gltf|png|jpe?g|webp|bmp|gif)$",
    ))
    .unwrap()
});

// Ce qu'on lit et range dans le dossier des projets : des modèles, ce qui accompagne
// un .obj (les annexes de js/02-import.js) et les pièces du mode conception (.json,
// conception.html). La page nettoie le nom avant l'envoi (nomProjet de js/11-projets.js).
pub static NOM_PROJET: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^[\w(][\w .()+-]*\.(?:stpz?|step|igs|iges|brep|brp|stl|3mf|obj|mtl|glb|gltf|png|jpe?g|webp|bmp|gif|json)$").unwrap()
});
pub const MAX_PROJET: i64 = 200 * 1024 * 1024;

/// Le fichier de `dossier` que désigne `relatif`, ou None s'il en sortirait.
pub fn chemin_projet(relatif: &str, dossier: &Path) -> Option<PathBuf> {
    let relatif = relatif.replace('\\', "/");
    let morceaux: Vec<&str> = relatif.split('/').filter(|m| !m.is_empty()).collect();
    if !NOM_PROJET.is_match(morceaux.last()?) || morceaux.iter().any(|m| m.starts_with('.') || m.contains(':')) {
        return None;
    }
    let racine = fs::canonicalize(dossier).ok()?;
    let cible = morceaux.iter().fold(racine.clone(), |c, m| c.join(m));
    let reel = match fs::canonicalize(&cible) {
        Ok(reel) => reel,
        // shortcut: un lien mort est refusé, Python suivait sa cible si elle restait dans le dossier
        Err(_) if cible.symlink_metadata().is_ok() => return None,
        Err(_) => fs::canonicalize(cible.parent()?).ok()?.join(cible.file_name()?),
    };
    (reel != racine && reel.starts_with(&racine)).then_some(reel)
}

/// `complet` vu depuis `racine`, avec des « / ».
fn relatif(complet: &Path, racine: &Path) -> String {
    let dedans = complet.strip_prefix(racine).unwrap_or(complet);
    dedans.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/")
}

/// Les fichiers 3D de `projets`, sous-dossiers compris, du plus récent au plus ancien.
pub fn lister_projets(projets: &Path) -> Vec<Value> {
    fn parcourir(racine: &Path, dossier: &Path, sortie: &mut Vec<(i64, Value)>) {
        let Ok(entrees) = fs::read_dir(dossier) else { return };
        let mut sous = Vec::new();
        for entree in entrees.flatten() {
            let nom = entree.file_name();
            let (Some(nom), Ok(genre)) = (nom.to_str(), entree.file_type()) else { continue };
            if genre.is_dir() {
                if !nom.starts_with('.') {
                    sous.push(entree.path());
                }
            // Un lien symbolique n'est pas un fichier du projet : mort, il faisait planter la liste ;
            // vers l'extérieur, il n'est de toute façon pas servi (chemin_projet)
            } else if NOM_PROJET.is_match(nom) && !genre.is_symlink() {
                let Ok(st) = entree.metadata() else { continue };
                let date = st.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map_or(0, |d| d.as_secs() as i64);
                sortie.push((date, json!({"chemin": relatif(&entree.path(), racine), "taille": st.len(), "date": date})));
            }
        }
        for s in sous {
            parcourir(racine, &s, sortie);
        }
    }
    let mut sortie = Vec::new();
    parcourir(projets, projets, &mut sortie);
    sortie.sort_by_key(|(date, _)| -date);
    sortie.into_iter().map(|(_, f)| f).collect()
}

/// Les types MIME : ceux qui manquaient à Python d'abord, puis ce que sa table rendait
/// pour les fichiers que STATIQUE et NOM_PROJET laissent passer.
pub fn type_mime(chemin: &Path) -> &'static str {
    let ext = chemin.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    match ext.as_str() {
        "wasm" => "application/wasm",
        "js" | "mjs" => "text/javascript",
        "json" => "application/json",
        "md" => "text/plain; charset=utf-8", // affiché par le navigateur : text/markdown se télécharge
        "stp" | "step" | "igs" | "iges" | "brep" | "stl" => "application/octet-stream",
        "3mf" => "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
        "obj" | "mtl" => "text/plain",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "txt" => "text/plain",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/vnd.microsoft.icon",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "xml" => "application/xml",
        "pdf" => "application/pdf",
        "stpz" => "model/step+zip",
        "gz" => "application/gzip",
        _ => "application/octet-stream",
    }
}

/// urllib.parse.unquote : %XX, et « + » reste « + » (un nom de fichier peut en porter).
pub fn decoder_chemin(s: &str) -> String {
    let b = s.as_bytes();
    let hex = |i: usize| b.get(i).and_then(|c| (*c as char).to_digit(16));
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match (b[i], hex(i + 1), hex(i + 2)) {
            (b'%', Some(h), Some(l)) => {
                out.push((h * 16 + l) as u8);
                i += 3;
            }
            (c, _, _) => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// json.dumps de Python : « , » et « : » suivis d'une espace.
struct StylePython;

impl serde_json::ser::Formatter for StylePython {
    fn begin_array_value<W: ?Sized + Write>(&mut self, w: &mut W, premier: bool) -> std::io::Result<()> {
        if premier { Ok(()) } else { w.write_all(b", ") }
    }
    fn begin_object_key<W: ?Sized + Write>(&mut self, w: &mut W, premier: bool) -> std::io::Result<()> {
        if premier { Ok(()) } else { w.write_all(b", ") }
    }
    fn begin_object_value<W: ?Sized + Write>(&mut self, w: &mut W) -> std::io::Result<()> {
        w.write_all(b": ")
    }
}

pub fn texte_json(charge: &Value) -> Vec<u8> {
    let mut corps = Vec::new();
    let mut s = serde_json::Serializer::with_formatter(&mut corps, StylePython);
    serde::Serialize::serialize(charge, &mut s).expect("JSON en mémoire");
    corps
}

fn reponse(code: u16, type_: &str, corps: Vec<u8>) -> Reponse {
    Reponse { code, entetes: vec![("Content-Type".into(), type_.into())], corps, suite: None }
}

fn rendre_json(code: u16, charge: Value) -> Reponse {
    reponse(code, "application/json; charset=utf-8", texte_json(&charge))
}

fn detail(code: u16, texte: &str) -> Reponse {
    rendre_json(code, json!({ "detail": texte }))
}

/// send_error de http.server : la même page d'erreur.
fn erreur(code: u16, message: &str) -> Reponse {
    let explication = match code {
        404 => "Nothing matches the given URI",
        _ => "Server does not support this operation",
    };
    let message = message.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    let corps = format!(
        "<!DOCTYPE HTML>\n<html lang=\"en\">\n    <head>\n        <meta charset=\"utf-8\">\n        <title>Error response</title>\n    </head>\n    <body>\n        <h1>Error response</h1>\n        <p>Error code: {code}</p>\n        <p>Message: {message}.</p>\n        <p>Error code explanation: {code} - {explication}.</p>\n    </body>\n</html>\n"
    );
    reponse(code, "text/html;charset=utf-8", corps.into_bytes())
}

fn introuvable() -> Reponse {
    erreur(404, "File not found")
}

/// Par blocs : un modèle de 200 Mo ne passe pas en mémoire.
fn fichier(cible: &Path) -> Reponse {
    let ouvert = fs::File::open(cible).and_then(|f| Ok((f.metadata()?, f)));
    match ouvert {
        Ok((st, f)) if st.is_file() => Reponse {
            code: 200,
            entetes: vec![("Content-Type".into(), type_mime(cible).into()), ("Content-Length".into(), st.len().to_string())],
            corps: Vec::new(),
            suite: Some(Box::new(f)),
        },
        _ => introuvable(),
    }
}

/// Le journal de http.server, sur la sortie d'erreur : tout sauf les lectures réussies.
fn journal(r: &Requete, code: u16) {
    if r.cible.contains("favicon.ico") || (r.lecture() && code == 200) {
        return;
    }
    let ligne = format!("\"{} {}\" {} -", r.methode, r.cible, code);
    eprintln!("{} - - [{}] {}", r.client.ip(), chrono::Local::now().format("%d/%b/%Y %H:%M:%S"), appairage::masquer(&ligne));
}

pub struct Visionneuse {
    /// Le dossier servi (--dossier).
    pub dossier: PathBuf,
    /// Le dossier des projets (--projets ; WEB_SUITE y passe PROJETS/3D, synchronisé
    /// avec GitHub). None : pas de projets, la page cache son bouton.
    pub projets: Option<PathBuf>,
    /// ~/.web_tools/ouvrir/ : les fichiers ouverts depuis le gestionnaire de fichiers
    pub ouvrir: PathBuf,
    // Host contrôlé (DNS rebinding) et code d'appairage exigé des autres appareils du
    // réseau : appairage.rs, commun aux web tools.
    pub garde: Garde,
    /// Canal de pilotage des pages par le MCP de web_suite
    pub pilote: Pilote,
}

impl Visionneuse {
    pub fn servir(&self, r: &mut Requete) -> Reponse {
        let rendu = match self.garde.filtrer(r) {
            Some(refus) => refus,
            None => match r.methode.as_str() {
                "GET" => self.get(r),
                "HEAD" => self.statique(r),
                "POST" => self.post(r),
                autre => erreur(501, &format!("Unsupported method ('{}')", autre)),
            },
        };
        journal(r, rendu.code);
        // En développement, un fichier modifié doit être servi modifié : le cache
        // du navigateur ferait perdre plus de temps qu'il n'en fait gagner.
        rendu
            .entete("Cache-Control", "no-store, max-age=0")
            // Pas d'affichage dans le cadre d'un autre site : un clic piégé sur « Appliquer » du panneau Claude
            .entete("X-Frame-Options", "SAMEORIGIN")
            .entete("Content-Security-Policy", "frame-ancestors 'self'")
    }

    fn get(&self, r: &mut Requete) -> Reponse {
        if let Some(rendu) = self.pilote.traiter(r) {
            return rendu;
        }
        if r.cible == "/favicon.ico" {
            return Reponse { code: 204, entetes: Vec::new(), corps: Vec::new(), suite: None };
        }
        let chemin = decoder_chemin(r.chemin());
        if chemin == "/api/projets" {
            let fichiers = self.projets.as_deref().map(lister_projets).unwrap_or_default();
            return rendre_json(200, json!({"dispo": self.projets.is_some(), "fichiers": fichiers}));
        }
        if let Some(relatif) = chemin.strip_prefix("/projets/") {
            return self.fichier_projet(relatif, self.projets.as_deref());
        }
        if let Some(relatif) = chemin.strip_prefix("/ouvrir/") {
            // Les fichiers que « web_3d ouvrir » a copiés depuis ce poste : jamais servis à un autre appareil
            if !appairage::ce_poste(r) {
                return introuvable();
            }
            return self.fichier_projet(relatif, Some(&self.ouvrir));
        }
        self.statique(r)
    }

    /// GET et HEAD passent tous deux par ici.
    fn statique(&self, r: &Requete) -> Reponse {
        let chemin = decoder_chemin(r.chemin());
        if !STATIQUE.is_match(&chemin) {
            return introuvable();
        }
        let mut cible = chemin.split('/').filter(|m| !m.is_empty()).fold(self.dossier.clone(), |c, m| c.join(m));
        if cible.is_dir() {
            if !chemin.ends_with('/') {
                let requete = if r.requete().is_empty() { String::new() } else { format!("?{}", r.requete()) };
                return Reponse { code: 301, entetes: Vec::new(), corps: Vec::new(), suite: None }
                    .entete("Location", &format!("{}/{}", r.chemin(), requete));
            }
            cible.push("index.html"); // « / » : le seul dossier que STATIQUE laisse passer
        }
        fichier(&cible)
    }

    fn fichier_projet(&self, relatif: &str, dossier: Option<&Path>) -> Reponse {
        match dossier.and_then(|d| chemin_projet(relatif, d)) {
            Some(cible) => fichier(&cible),
            None => introuvable(),
        }
    }

    /// POST /api/projets?nom=piece.stp : range le fichier reçu dans le dossier des projets.
    ///
    /// L'en-tête X-Web3D est exigé sur tout POST, canal de pilotage compris : une page
    /// d'un autre site ne peut pas l'ajouter sans pré-vol CORS, que ce serveur ne valide
    /// pas. On n'écrase jamais : un nom déjà pris devient « piece (2).stp ».
    ///
    /// Seule exception, explicite : POST /api/projets?nom=sous/piece.json&remplacer=1, le
    /// bouton « Enregistrer » du mode conception. Réservé aux .json, le remplacement passe
    /// par un fichier temporaire caché puis un renommage : jamais de pièce tronquée.
    fn post(&self, r: &mut Requete) -> Reponse {
        if r.entete("X-Web3D") != Some("1") {
            return detail(403, "Requête refusée");
        }
        if let Some(rendu) = self.pilote.traiter(r) {
            return rendu; // refuse lui-même une autre origine
        }
        let Some(projets) = self.projets.as_deref().filter(|_| r.chemin() == "/api/projets") else {
            return detail(404, "Route inconnue");
        };
        let requete = params(r.requete());
        let valeurs = |nom: &str| requete.iter().filter(|(k, v)| k == nom && !v.is_empty()).map(|(_, v)| v.as_str()).collect::<Vec<_>>();
        let relatif = valeurs("nom").first().copied().unwrap_or("").replace('\\', "/");
        let remplacer = valeurs("remplacer") == ["1"];
        let nom = relatif.rsplit('/').next().unwrap_or("");
        let taille: i64 = match r.entete("Content-Length") {
            None | Some("") => 0,
            Some(v) => v.trim().parse().unwrap_or(-1),
        };
        if !NOM_PROJET.is_match(nom) {
            return detail(400, &format!("Nom ou format refusé : {}", nom));
        }
        if nom.chars().count() > 150 {
            // au-delà, le système refuse le fichier (erreur 36) : on le dit avant
            return detail(400, "Nom trop long (150 caractères au plus)");
        }
        if remplacer && !nom.to_lowercase().ends_with(".json") {
            return detail(400, "Remplacement réservé aux pièces .json");
        }
        if !(0 < taille && taille <= MAX_PROJET) {
            return detail(413, &format!("Taille refusée ({} Mo au plus)", MAX_PROJET >> 20));
        }
        let (base, ext) = nom.rsplit_once('.').unwrap_or((nom, "")); // NOM_PROJET : il y a une extension
        let mut creer = fs::OpenOptions::new();
        creer.write(true).create_new(true);
        #[cfg(unix)]
        std::os::unix::fs::OpenOptionsExt::mode(&mut creer, 0o644);
        let (cible, mut sortie, temporaire);
        if remplacer {
            // chemin_projet garde la cible dans le dossier ; un lien ou un dossier à sa place est refusé
            let permis = chemin_projet(&relatif, projets)
                .filter(|c| !c.is_symlink() && (!c.exists() || c.is_file()))
                .and_then(|c| Some((c.parent().filter(|d| d.is_dir())?.to_path_buf(), c)));
            let Some((dossier, c)) = permis else { return detail(400, "Nom refusé") };
            // « .xxx.tmp » : un nom caché n'est ni listé ni servi (NOM_PROJET, chemin_projet)
            match fichier_temporaire(&dossier, &creer) {
                Ok((f, t)) => (cible, sortie, temporaire) = (c, f, Some(t)),
                Err(e) => return detail(500, &e.to_string()),
            }
        } else {
            // Le nom se réserve en le créant, en exclusif et sans suivre de lien : deux envois du même
            // nom ne s'écrasent pas, et un lien déposé dans le dossier ne fait pas écrire ailleurs.
            // Plus de « .part » commun : un fichier coupé en route est retiré.
            #[cfg(unix)]
            std::os::unix::fs::OpenOptionsExt::custom_flags(&mut creer, libc::O_NOFOLLOW);
            let (mut essai, mut n, mut ouvert) = (chemin_projet(nom, projets), 2, None);
            while let (Some(c), true) = (&essai, n < 1000) {
                match creer.open(c) {
                    Ok(f) => {
                        ouvert = Some((c.clone(), f));
                        break;
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                        essai = chemin_projet(&format!("{} ({}).{}", base, n, ext), projets);
                        n += 1;
                    }
                    Err(e) => return detail(500, &e.to_string()),
                }
            }
            let Some((c, f)) = ouvert else { return detail(400, "Nom refusé") };
            (cible, sortie, temporaire) = (c, f, None);
        }
        let ecrit = temporaire.as_ref().unwrap_or(&cible);
        let (mut reste, mut illisible, mut panne) = (taille as usize, false, None);
        let mut bloc = vec![0u8; reste.min(1 << 20)];
        let corps = r.flux_corps();
        while reste > 0 && panne.is_none() {
            let n = bloc.len().min(reste);
            match corps.read(&mut bloc[..n]) {
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => {}
                Ok(0) | Err(_) => break, // fin prématurée, client parti ou muet depuis le délai
                Ok(n) => {
                    panne = sortie.write_all(&bloc[..n]).err();
                    reste -= n;
                }
            }
        }
        drop(sortie);
        let mut complet = reste == 0 && panne.is_none();
        if complet && temporaire.is_some() {
            // une pièce tronquée ou illisible n'écrase pas la bonne
            match fs::read(ecrit).map(|lu| serde_json::from_slice::<Value>(&lu).is_ok()) {
                Ok(true) => panne = fs::rename(ecrit, &cible).err(),
                Ok(false) => illisible = true,
                Err(e) => panne = Some(e),
            }
            complet = !illisible && panne.is_none();
        }
        if !complet {
            // fin prématurée, coupure, disque plein : pas de fichier tronqué dans le dossier
            let _ = fs::remove_file(ecrit);
        }
        if illisible {
            return detail(400, "Pièce illisible (JSON invalide) : rien n'a été remplacé");
        }
        if let Some(e) = panne {
            return detail(500, &e.to_string());
        }
        if !complet {
            return detail(400, "Envoi interrompu");
        }
        // chemins réels des deux côtés : un chemin court Windows (PIERRE~1) ne se compare pas au long
        let racine = fs::canonicalize(projets).unwrap_or_else(|_| projets.to_path_buf());
        rendre_json(200, json!({ "chemin": self::relatif(&cible, &racine) }))
    }
}

/// tempfile.mkstemp(prefix=".", suffix=".tmp") : un fichier neuf, caché, lisible comme les autres.
fn fichier_temporaire(dossier: &Path, creer: &fs::OpenOptions) -> std::io::Result<(fs::File, PathBuf)> {
    static NUMERO: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    loop {
        let instant = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.subsec_nanos());
        let n = NUMERO.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let chemin = dossier.join(format!(".{:x}{:08x}{:x}.tmp", std::process::id(), instant, n));
        match creer.open(&chemin) {
            Ok(f) => {
                #[cfg(unix)]
                fs::set_permissions(&chemin, std::os::unix::fs::PermissionsExt::from_mode(0o644))?;
                return Ok((f, chemin));
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(e),
        }
    }
}

#[cfg(test)]
mod essais {
    use super::*;

    #[test]
    fn statique_et_noms() {
        for permis in ["/", "/index.html", "/CONCEPTION.html", "/js/09-demarrage.js", "/vendor/occt/occt-import-js.wasm", "/sous dossier/pièce (2).STP"] {
            assert!(STATIQUE.is_match(permis), "{}", permis);
        }
        for refuse in ["/.git/config", "/README.md", "/js/", "/js/../web_3D.py", "/Cargo.toml", "/src/main.rs", "/.git/piece.stp", "/C:\\Windows\\win.ini", "/a/..stp/b.stp"] {
            assert!(!STATIQUE.is_match(refuse), "{}", refuse);
        }
        assert!(NOM_PROJET.is_match("t (2).stl") && NOM_PROJET.is_match("p.JSON"));
        assert!(!NOM_PROJET.is_match(".cache.stl") && !NOM_PROJET.is_match("x.txt") && !NOM_PROJET.is_match("a/b.stl"));
    }

    #[test]
    fn chemins_des_projets() {
        let tmp = std::env::temp_dir().join(format!("web3d-essai-{}", std::process::id()));
        let projets = tmp.join("projets");
        fs::create_dir_all(projets.join("sous")).unwrap();
        fs::write(tmp.join("dehors.stl"), "x").unwrap();
        let racine = fs::canonicalize(&projets).unwrap();
        assert_eq!(chemin_projet("sous\\p.json", &projets), Some(racine.join("sous").join("p.json")));
        assert_eq!(chemin_projet("neuf.stl", &projets), Some(racine.join("neuf.stl")));
        for refuse in ["", "../dehors.stl", "sous/../../dehors.stl", ".git/p.stl", "C:/p.stl", "absent/p.json", "sous"] {
            assert_eq!(chemin_projet(refuse, &projets), None, "{}", refuse);
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(tmp.join("dehors.stl"), projets.join("lien.stl")).unwrap();
            std::os::unix::fs::symlink(tmp.join("absent.stl"), projets.join("mort.stl")).unwrap();
            assert_eq!(chemin_projet("lien.stl", &projets), None);
            assert_eq!(chemin_projet("mort.stl", &projets), None);
            assert!(lister_projets(&projets).is_empty());
        }
        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn json_comme_python_et_adresses() {
        let v = json!({"dispo": true, "fichiers": [{"chemin": "été.stl", "taille": 1}, 2]});
        assert_eq!(String::from_utf8(texte_json(&v)).unwrap(), r#"{"dispo": true, "fichiers": [{"chemin": "été.stl", "taille": 1}, 2]}"#);
        assert_eq!(decoder_chemin("/a+b%20c/%2e%2e/%C3%A9%zz"), "/a+b c/../é%zz");
        assert_eq!(type_mime(Path::new("x.WASM")), "application/wasm");
        assert_eq!(type_mime(Path::new("x.brp")), "application/octet-stream");
    }
}
