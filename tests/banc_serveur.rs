//! Banc du serveur : ce qu'il sert, ce qu'il refuse.
//!
//!     cargo test --test banc_serveur
//!
//! Démarre l'exécutable web_3d (boîte noire : sous-processus et HTTP) sur un port
//! libre de 127.0.0.1 et vérifie que la page, le noyau WebAssembly et les exemples
//! se chargent, que rien d'autre du dossier ne sort (.git, sources, listes de
//! fichiers) et qu'un Host étranger est refusé (DNS rebinding).
//!
//! Ce qui ne se voit pas de l'extérieur (noms sûrs et copie de « ouvrir », chemins des
//! projets, mise à jour git) est vérifié par les tests unitaires (src/).
mod commun;

use std::fmt::Debug;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Shutdown, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::time::{Duration, Instant};

use commun::Rep;
use serde_json::{json, Value};

const EXE: &str = env!("CARGO_BIN_EXE_web_3d");
const RACINE: &str = env!("CARGO_MANIFEST_DIR");

/// Les vérifications faites et celles qui ont échoué : tout est essayé, le bilan vient à la fin.
#[derive(Default)]
struct Bilan {
    essais: usize,
    echecs: Vec<String>,
}

impl Bilan {
    fn verifier<T: PartialEq + Debug>(&mut self, nom: &str, obtenu: T, attendu: T) {
        self.essais += 1;
        if obtenu != attendu {
            self.echecs.push(format!("ECHEC {nom} : attendu {attendu:?}, obtenu {obtenu:?}"));
        }
    }
}

/// Un serveur web_3d lancé ; `stdout` reste ouvert tant qu'il tourne (il y écrit encore).
struct Lance {
    proc: Child,
    _stdout: BufReader<ChildStdout>,
    port: u16,
    annonce: String,
}

impl Lance {
    fn arreter(mut self) {
        #[cfg(unix)]
        unsafe {
            libc::kill(self.proc.id() as libc::pid_t, libc::SIGTERM);
        }
        #[cfg(not(unix))]
        let _ = self.proc.kill();
        let limite = Instant::now() + Duration::from_secs(10);
        while self.proc.try_wait().unwrap().is_none() {
            assert!(Instant::now() < limite, "web_3d ne s'arrête pas");
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}

impl Drop for Lance {
    fn drop(&mut self) {
        let _ = self.proc.kill();
        let _ = self.proc.wait();
    }
}

/// Le dossier personnel du serveur : l'inscription « Ouvrir avec » et ~/.web_tools/ouvrir/
/// restent dans un dossier d'essai.
struct Maison {
    dossier: PathBuf,
    journal: fs::File,
}

impl Maison {
    /// Lance web_3d sur un port libre ; rend la main quand il sert.
    fn demarrer(&self, args: &[&str], env: &[(&str, &str)]) -> Lance {
        let mut proc = Command::new(EXE)
            .args(["--local", "--sans-navigateur", "--sans-maj", "--sans-pause", "--port", "0"]).args(args)
            .current_dir(RACINE)
            .env_remove("XDG_CONFIG_HOME").env_remove("XDG_DATA_HOME")
            .env("HOME", &self.dossier).env("USERPROFILE", &self.dossier).env("WEB_3D_DEPOT", RACINE).envs(env.iter().copied())
            .stdout(Stdio::piped()).stderr(self.journal.try_clone().unwrap())
            .spawn().unwrap();
        let mut stdout = BufReader::new(proc.stdout.take().unwrap());
        let mut annonce = String::new();
        while !annonce.lines().last().is_some_and(|l| l.contains("Ctrl+C")) {
            assert!(stdout.read_line(&mut annonce).unwrap() > 0, "web_3d s'est arrêté au démarrage :\n{annonce}");
        }
        let port = annonce.split_once("adresse : http://127.0.0.1:").and_then(|(_, s)| s.split_once('/')).and_then(|(p, _)| p.parse().ok())
            .unwrap_or_else(|| panic!("adresse attendue dans :\n{annonce}"));
        Lance { proc, _stdout: stdout, port, annonce }
    }
}

impl Drop for Maison {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.dossier);
    }
}

fn requete(port: u16, methode: &str, chemin: &str, corps: &[u8], entetes: &[(&str, &str)]) -> Rep {
    commun::requete(port, methode, chemin, entetes, corps).unwrap()
}

fn code(port: u16, chemin: &str) -> u16 {
    requete(port, "GET", chemin, b"", &[]).code
}

fn chemin_de(r: &Rep) -> Value {
    r.json()["chemin"].clone()
}

/// Un POST de 100 000 octets annoncés dont dix seulement partent. `fermer` : le client ferme son
/// côté et lit la réponse ; sinon il se tait : le fichier entamé apparaît, puis disparaît au bout
/// du délai du serveur. Rend (réponse, le fichier existe encore).
fn envoi_partiel(port: u16, tmp: &Path, nom: &str, fermer: bool) -> (Vec<u8>, bool) {
    let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
    s.set_read_timeout(Some(Duration::from_secs(10))).unwrap();
    s.write_all(format!("POST /api/projets?nom={nom} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nX-Web3D: 1\r\nContent-Length: 100000\r\n\r\nxxxxxxxxxx").as_bytes()).unwrap();
    let existe = || tmp.join(nom).exists();
    let reponse = if fermer {
        s.shutdown(Shutdown::Write).unwrap();
        let mut r = [0u8; 100];
        let n = s.read(&mut r).unwrap_or(0);
        r[..n].to_vec()
    } else {
        let fin = Instant::now() + Duration::from_secs(5);
        while !existe() && Instant::now() < fin {
            std::thread::sleep(Duration::from_millis(20));
        }
        let reponse = if existe() { b"entame".to_vec() } else { Vec::new() };
        while existe() && Instant::now() < fin {
            std::thread::sleep(Duration::from_millis(50));
        }
        reponse
    };
    drop(s);
    (reponse, existe())
}

/// Coupe la connexion par un RST (SO_LINGER à zéro) ; hors Unix, une fermeture ordinaire.
fn couper(s: TcpStream) {
    #[cfg(unix)]
    unsafe {
        use std::os::fd::AsRawFd;
        let l = libc::linger { l_onoff: 1, l_linger: 0 };
        libc::setsockopt(s.as_raw_fd(), libc::SOL_SOCKET, libc::SO_LINGER, &l as *const _ as *const libc::c_void,
                         std::mem::size_of::<libc::linger>() as libc::socklen_t);
    }
    drop(s);
}

#[test]
fn banc() {
    let dossier = std::env::temp_dir().join(format!("banc-web3d-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dossier);
    fs::create_dir_all(dossier.join(".config")).unwrap();
    let journal = fs::File::options().create(true).truncate(true).read(true).write(true).open(dossier.join("erreurs.txt")).unwrap();
    let maison = Maison { dossier: dossier.clone(), journal };
    let tmp = dossier.join("projets-essai");
    fs::create_dir_all(&tmp).unwrap();
    let mut b = Bilan::default();

    let poste = maison.demarrer(&[], &[]);
    let port = poste.port;

    // (chemin, Host, code attendu)
    let cas: &[(&str, Option<&str>, u16)] = &[
        ("/", None, 200),
        ("/index.html", None, 200),
        ("/css/visionneuse-3d.css", None, 200),
        ("/js/09-demarrage.js", None, 200),
        ("/vendor/occt/occt-import-js.wasm", None, 200),
        ("/exemples/assemblage-as1.stp", None, 200),
        ("/favicon.ico", None, 204),
        ("/.git/config", None, 404),
        ("/.git/HEAD", None, 404),
        ("/.gitignore", None, 404),
        ("/Cargo.toml", None, 404),
        ("/src/main.rs", None, 404),
        ("/README.md", None, 404),
        ("/js/", None, 404),
        ("/exemples/", None, 404),
        ("/js/../Cargo.toml", None, 404),
        ("/js/%2e%2e/Cargo.toml", None, 404),
        ("/C:%5cWindows%5cwin.ini", None, 404),
        ("/.git/piece.stp", None, 404),
        ("/", Some("192.168.1.20:8139"), 200),
        ("/", Some("localhost:8139"), 200),
        ("/", Some("evil.example:8139"), 403),
    ];
    for (chemin, hote, attendu) in cas {
        let entetes: Vec<(&str, &str)> = hote.iter().map(|h| ("Host", *h)).collect();
        b.verifier(&format!("{chemin} Host={hote:?}"), requete(port, "GET", chemin, b"", &entetes).code, *attendu);
    }
    b.verifier("HEAD /.git/config", requete(port, "HEAD", "/.git/config", b"", &[]).code, 404);

    // --- Projets (--projets) : lister, ranger, relire, sans sortir du dossier ---
    let x: &[(&str, &str)] = &[("X-Web3D", "1")];
    b.verifier("sans --projets : pas de projets", requete(port, "GET", "/api/projets", b"", &[]).json()["dispo"].clone(), json!(false));
    let annonce_2;
    {
        // un second serveur, avec --projets ; son délai de lecture du socket est d'une seconde
        let second = maison.demarrer(&["--projets", tmp.to_str().unwrap()], &[("WEB_3D_BANC_DELAI", "1")]);
        annonce_2 = second.annonce.clone();
        let port = second.port;
        fs::write(tmp.join("secret.txt"), "non").unwrap();
        let stl = fs::read(Path::new(RACINE).join("exemples").join("tetraedre.stl")).unwrap();
        let ranger_avec = |nom: &str, entetes: &[(&str, &str)]| requete(port, "POST", &format!("/api/projets?nom={nom}"), &stl, entetes);
        let ranger = |nom: &str| ranger_avec(nom, x);
        let lire = |chemin: &str| requete(port, "GET", chemin, b"", &[]);
        b.verifier("rangement sans X-Web3D", ranger_avec("t.stl", &[]).code, 403);
        b.verifier("rangement d'un .txt", ranger("x.txt").code, 400);
        b.verifier("nom qui remonte : gardé dans le dossier", chemin_de(&ranger("..%2F..%2Ft.stl")), json!("t.stl"));
        b.verifier("pas d'écrasement", chemin_de(&ranger("t.stl")), json!("t (2).stl"));
        let liste = lire("/api/projets").json();
        let mut chemins: Vec<String> = liste["fichiers"].as_array().unwrap().iter().map(|f| f["chemin"].as_str().unwrap().to_string()).collect();
        chemins.sort();
        b.verifier("liste", (liste["dispo"].clone(), chemins), (json!(true), vec!["t (2).stl".to_string(), "t.stl".to_string()]));
        b.verifier("relecture", lire("/projets/t.stl").corps == stl, true);
        for nom in ["m.glb", "m.gltf"] {
            // la page les ouvre : ils se rangent aussi
            b.verifier(&format!("rangement {nom}"), chemin_de(&ranger(nom)), json!(nom));
            b.verifier(&format!("relecture {nom}"), lire(&format!("/projets/{nom}")).corps == stl, true);
            fs::remove_file(tmp.join(nom)).unwrap();
        }
        for chemin in ["/projets/secret.txt", "/projets/../Cargo.toml", "/projets/..%5cCargo.toml",
                       "/projets/C:%5cWindows%5cwin.ini", "/projets/.git/config"] {
            b.verifier(&format!("refus {chemin}"), lire(chemin).code, 404);
        }

        // Pièces du mode conception : remplacement explicite, réservé aux .json, atomique
        let piece = |corps: &[u8], nom: &str, rem: &str| requete(port, "POST", &format!("/api/projets?nom={nom}{rem}"), corps, x);
        let remplacer = "&remplacer=1";
        b.verifier("pièce .json rangée", chemin_de(&piece(br#"{"v":1}"#, "p.json", "")), json!("p.json"));
        b.verifier("pièce .json remplacée sur demande", (chemin_de(&piece(br#"{"v":2}"#, "p.json", remplacer)), lire("/projets/p.json").texte()),
                   (json!("p.json"), r#"{"v":2}"#.to_string()));
        b.verifier("remplacement refusé hors .json", piece(&stl, "t.stl", remplacer).code, 400);
        b.verifier("remplacement : nom qui remonte refusé", piece(b"{}", "..%2Fp.json", remplacer).code, 400);
        b.verifier("remplacement : sous-dossier absent refusé", piece(b"{}", "absent%2Fp.json", remplacer).code, 400);
        let restes: Vec<String> = fs::read_dir(&tmp).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|f| f.ends_with(".tmp")).collect();
        b.verifier("remplacement : aucun .tmp laissé", restes, vec![]);
        b.verifier("page de conception servie", lire("/conception.html").code, 200);
        b.verifier("règles de conception servies", lire("/regles-conception.md").code, 200);
        b.verifier("seul ce .md est servi", lire("/README.md").code, 404);

        // Un lien symbolique « piege.stl.part » déposé dans PROJETS (dépôt synchronisé) ne fait
        // pas écrire ailleurs : l'écriture va dans la cible, créée en exclusif, sans suivre de lien
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let dehors = dossier.join("dehors");
            fs::create_dir_all(&dehors).unwrap();
            let victime = dehors.join("victime.txt");
            fs::write(&victime, "intact").unwrap();
            symlink(&victime, tmp.join("piege.stl.part")).unwrap();
            b.verifier("lien .part piégé : rangé quand même", chemin_de(&ranger("piege.stl")), json!("piege.stl"));
            b.verifier("lien .part piégé : rien écrit dehors", fs::read_to_string(&victime).unwrap(), "intact".to_string());
            b.verifier("lien .part piégé : un vrai fichier", tmp.join("piege.stl").is_symlink(), false);
            // Liens morts ou vers l'extérieur : ni listés, ni cause d'erreur
            symlink(dehors.join("absent.stl"), tmp.join("mort.stl")).unwrap();
            symlink(&victime, tmp.join("dehors.stl")).unwrap();
            let r = lire("/api/projets");
            let liste = if r.code == 200 { r.json()["fichiers"].clone() } else { json!([]) };
            let liste_a = |nom: &str| liste.as_array().unwrap().iter().any(|f| f["chemin"] == nom);
            b.verifier("liens symboliques ignorés par la liste", (r.code, liste_a("mort.stl"), liste_a("dehors.stl")), (200, false, false));
        }

        // Deux rangements simultanés du même nom : deux fichiers, chacun intact (jamais d'écrasement)
        let corps_ab = [vec![b'A'; 2 << 20], vec![b'B'; 2 << 20]];
        let rendus: Vec<Rep> = std::thread::scope(|s| {
            let fils: Vec<_> = corps_ab.iter().map(|c| s.spawn(move || requete(port, "POST", "/api/projets?nom=course.stl", c, x))).collect();
            fils.into_iter().map(|f| f.join().unwrap()).collect()
        });
        let places: Vec<(usize, String)> = rendus.iter().enumerate().filter(|(_, r)| r.code == 200)
            .map(|(k, r)| (k, r.json()["chemin"].as_str().unwrap().to_string())).collect();
        let distincts: std::collections::HashSet<&String> = places.iter().map(|(_, c)| c).collect();
        b.verifier("course : deux réponses 200, deux noms", (places.len(), distincts.len()), (2, 2));
        b.verifier("course : chaque fichier a son propre contenu",
                   places.iter().all(|(k, c)| fs::read(tmp.join(c)).unwrap() == corps_ab[*k]), true);

        b.verifier("annexes de la page (.webp, .bmp, .gif) rangées",
                   ["webp", "bmp", "gif"].map(|e| ranger(&format!("t.{e}")).code), [200, 200, 200]);

        // Envoi coupé : fin prématurée (le client ferme) ou client muet au-delà du délai : aucun fichier tronqué
        let (reponse, reste) = envoi_partiel(port, &tmp, "coupe.stl", true);
        b.verifier("envoi coupé : 400 et fichier retiré", (String::from_utf8_lossy(reponse.get(9..12).unwrap_or(b"")).into_owned(), reste),
                   ("400".to_string(), false));
        b.verifier("client muet au-delà du délai : fichier retiré", envoi_partiel(port, &tmp, "muet.stl", false), (b"entame".to_vec(), false));
        second.arreter();
    }

    // Canal de pilotage (pilote.rs de web_suite, MCP) : X-Web3D exigé sur tout POST, le pilote
    // refuse en plus une autre origine ; la page bat, le MCP de ce poste voit l'onglet
    let lire = |chemin: &str| requete(port, "GET", chemin, b"", &[]);
    let battement = json!({"navigateur": "n1", "onglets": [{"id": "o1", "page": "3d", "projet": "", "focus_il_y_a": 0}]}).to_string();
    let battre = |entetes: &[(&str, &str)]| requete(port, "POST", "/api/pilote/battement", battement.as_bytes(), entetes).code;
    let onglets = || lire("/api/pilote/onglets").json()["onglets"].as_array().unwrap().iter().map(|o| o["id"].clone()).collect::<Vec<_>>();
    b.verifier("pilote : sans X-Web3D, battement refusé", battre(&[("Content-Type", "application/json")]), 403);
    b.verifier("pilote : sans X-Web3D, aucun onglet noté", onglets(), vec![]);
    let json_ = [("Content-Type", "application/json"), ("X-Web3D", "1")];
    b.verifier("pilote : autre origine refusée", battre(&[json_[0], json_[1], ("Origin", "http://evil.example")]), 403);
    b.verifier("pilote : battement de la page", battre(&[json_[0], json_[1], ("Origin", &format!("http://127.0.0.1:{port}"))]), 200);
    b.verifier("pilote : onglet vu par le MCP", onglets(), vec![json!("o1")]);
    b.verifier("pilote : fichiers de la page servis", (code(port, "/js/pilote.js"), code(port, "/css/pilote.css")), (200, 200));
    let r = lire("/");
    b.verifier("cadres : même origine seulement",
               (r.entete("X-Frame-Options"), r.entete("Content-Security-Policy").unwrap_or("").contains("frame-ancestors 'self'")),
               (Some("SAMEORIGIN"), true));

    // Ouvrir depuis le gestionnaire de fichiers (web_3d ouvrir) : la copie est servie au seul poste.
    // Les noms sûrs et la copie elle-même (vieilles copies retirées) : tests unitaires, ouvrir.rs.
    let ouvrir = dossier.join(".web_tools").join("ouvrir");
    fs::create_dir_all(&ouvrir).unwrap();
    fs::write(ouvrir.join("Pièce_ v2.step"), b"ISO-10303-21;").unwrap();
    let url = "/ouvrir/Pi%C3%A8ce_%20v2.step";
    b.verifier("ouvrir : servi au poste", lire(url).corps, b"ISO-10303-21;".to_vec());
    for chemin in ["/ouvrir/../Cargo.toml", "/ouvrir/..%2F..%2Fsecret.stp", "/ouvrir/.part"] {
        b.verifier(&format!("ouvrir : refus {chemin}"), lire(chemin).code, 404);
    }
    // WEB_TOOLS_BANC_DISTANT=1 : ce serveur-là traite le poste comme un autre appareil
    let distant = maison.demarrer(&[], &[("WEB_TOOLS_BANC_DISTANT", "1")]);
    let annonce_3 = distant.annonce.clone();
    b.verifier("ouvrir : refusé à un autre appareil", (code(distant.port, url), code(distant.port, "/")), (404, 200));
    distant.arreter();
    if !cfg!(windows) {
        // inscription au démarrage : une fois, puis rien tant que le dossier ne bouge pas
        b.verifier("associer : la première fois, puis plus",
                   [&poste.annonce, &annonce_2, &annonce_3].map(|a| a.contains("Ouvrir avec :")), [true, false, false]);
        let entree = fs::read_to_string(dossier.join(".local").join("share").join("applications").join("web3d-ouvrir.desktop")).unwrap_or_default();
        let exe = fs::canonicalize(EXE).unwrap();
        b.verifier("associer : l'entrée lance « web_3d ouvrir »", entree.contains(&format!("Exec=\"{}\" ouvrir %f\n", exe.display())), true);
    }

    // --- Un client coupé en pleine réponse n'est pas une erreur à afficher, et le serveur continue ---
    for _ in 0..3 {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.write_all(format!("GET /vendor/occt/occt-import-js.wasm HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n").as_bytes()).unwrap();
        let _ = s.read(&mut [0u8; 1000]);
        couper(s); // RST à la fermeture
    }
    b.verifier("client coupé : le serveur sert toujours", code(port, "/conception.html"), 200);
    let erreurs = fs::read_to_string(dossier.join("erreurs.txt")).unwrap();
    b.verifier("client coupé : rien d'affiché",
               erreurs.lines().filter(|l| l.contains("panicked") || l.contains("occt-import")).collect::<Vec<_>>(), vec![]);
    b.verifier("journal : les refus y sont, pas les lectures réussies",
               (erreurs.contains("\"GET /.git/config\" 404"), erreurs.contains("\"GET /index.html\" 200")), (true, false));

    poste.arreter();
    for e in &b.echecs {
        println!("{e}");
    }
    println!("{}/{} ok", b.essais - b.echecs.len(), b.essais);
    assert!(b.echecs.is_empty(), "{} échec(s) :\n{}", b.echecs.len(), b.echecs.join("\n"));
    if cfg!(unix) {
        assert_eq!(b.essais, 74, "le nombre de vérifications du banc d'origine");
    }
}
