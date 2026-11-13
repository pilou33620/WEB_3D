// =============================================================================
// Visionneuse 3D — web_3d
//
// Un serveur de fichiers statiques, et rien d'autre : la lecture des fichiers
// CAO se fait entièrement dans le navigateur. Il n'existe que pour deux raisons.
//
//   1. WebAssembly. Le noyau OpenCascade est chargé par `fetch` ; en `file://`
//      le navigateur refuse la requête (origine « null »). Il faut donc du HTTP,
//      même en local.
//   2. Le type MIME `application/wasm`. Sans lui, Chrome et Firefox refusent la
//      compilation en continu du module — et se contentent d'un message obscur
//      dans la console.
//
//     web_3d                       sert la page et l'ouvre dans le navigateur
//     web_3d ouvrir piece.step     « Ouvrir avec WEB_3D » (voir ouvrir.rs)
// =============================================================================

mod maj;
mod ouvrir;
mod serveur_3d;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use web_tools_commun::appairage::{self, Garde};
use web_tools_commun::pilote::Pilote;
use web_tools_commun::serveur::{Requete, Serveur};

/// La racine du dépôt WEB_3D (là où vivent index.html, js/, css/…).
/// L'exécutable n'est pas à côté des pages comme l'était web_3D.py : on la donne
/// par WEB_3D_DEPOT (scripts demarrer_*), sinon on remonte depuis l'exécutable
/// puis depuis le dossier courant jusqu'à trouver index.html et js/.
pub fn depot() -> PathBuf {
    if let Some(d) = std::env::var_os("WEB_3D_DEPOT").filter(|d| !d.is_empty()) {
        return PathBuf::from(d);
    }
    let departs = [std::env::current_exe().ok(), std::env::current_dir().ok()];
    for depart in departs.into_iter().flatten() {
        if let Some(d) = depart.ancestors().find(|d| d.join("index.html").is_file() && d.join("js").is_dir()) {
            return d.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_default()
}

/// shutil.which : l'exécutable `nom` dans le PATH.
pub fn quel(nom: &str) -> Option<PathBuf> {
    let extensions: &[&str] = if cfg!(windows) { &[".exe", ".cmd", ".bat", ""] } else { &[""] };
    std::env::split_paths(&std::env::var_os("PATH")?)
        .flat_map(|d| extensions.iter().map(move |e| d.join(format!("{}{}", nom, e))))
        .find(|p| p.is_file())
}

/// webbrowser.open : la page dans le navigateur par défaut du poste.
pub fn ouvrir_navigateur(url: &str) {
    let mut cmd = if cfg!(windows) {
        let mut c = std::process::Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", url]);
        c
    } else {
        let mut c = std::process::Command::new(if cfg!(target_os = "macos") { "open" } else { "xdg-open" });
        c.arg(url);
        c
    };
    use std::process::Stdio;
    let _ = cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn();
}

/// Adresse de la machine sur le réseau, pour ouvrir la page sur une tablette.
fn adresse_locale() -> String {
    let par_route = || {
        let s = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
        s.connect("8.8.8.8:80").ok()?; // aucun paquet n'est envoyé
        Some(s.local_addr().ok()?.ip().to_string())
    };
    par_route().unwrap_or_else(|| "127.0.0.1".into())
}

/// Noms des executables attaches a la console, le notre compris.
///
/// Renvoie une liste vide quand la question n'a pas de reponse sure -- pas de
/// console, ou un processus qu'on n'a pas le droit de nommer. L'appelant doit
/// alors s'en tenir au comportement par defaut plutot que de deviner.
#[cfg(windows)]
fn processus_de_la_console() -> Vec<String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Console::GetConsoleProcessList;
    use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};

    let mut pids = [0u32; 16];
    let combien = unsafe { GetConsoleProcessList(pids.as_mut_ptr(), pids.len() as u32) } as usize;
    if combien == 0 || combien > pids.len() {
        return Vec::new();
    }
    let mut noms = Vec::new();
    for &pid in &pids[..combien] {
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if handle.is_null() {
            return Vec::new();
        }
        let mut chemin = vec![0u16; 32768];
        let mut longueur = chemin.len() as u32;
        let ok = unsafe { QueryFullProcessImageNameW(handle, 0, chemin.as_mut_ptr(), &mut longueur) };
        unsafe { CloseHandle(handle) };
        if ok == 0 {
            return Vec::new();
        }
        let complet = String::from_utf16_lossy(&chemin[..longueur as usize]);
        noms.push(complet.rsplit(['\\', '/']).next().unwrap_or("").to_lowercase());
    }
    noms
}

/// Vrai quand Windows a cree la console POUR cet executable -- c'est-a-dire
/// quand il a ete lance depuis l'Explorateur.
///
/// Elle sert a retenir la fenetre : sans cela, une erreur de demarrage
/// disparait avec elle, et l'outil a « juste rien fait ».
///
/// COMMENT ON LE SAIT. Un terminal laisse son shell attache a la console :
/// cmd.exe, powershell.exe, bash.exe y figurent a cote de nous -- cmd.exe aussi
/// quand c'est demarrer_WEB_3D.cmd qui nous lance, et c'est alors lui qui retient
/// la fenetre. Un double-clic sur l'executable ne fait venir que lui -- et pas
/// forcement un seul processus : apres une mise a jour, il se relance et attend
/// son double. Compter les processus ne suffit donc pas : on les nomme.
pub fn lance_par_double_clic() -> bool {
    #[cfg(windows)]
    {
        let moi = std::env::current_exe().ok().and_then(|e| Some(e.file_name()?.to_string_lossy().to_lowercase()));
        let noms = processus_de_la_console();
        !noms.is_empty() && noms.iter().all(|n| Some(n) == moi.as_ref())
    }
    #[cfg(not(windows))]
    false
}

/// Retient la fenêtre le temps de lire ce qui vient d'être écrit.
fn attendre(interactif: bool) {
    if !interactif {
        return;
    }
    print!("\nAppuyez sur Entrée pour fermer…");
    let _ = std::io::stdout().flush();
    let _ = std::io::stdin().read_line(&mut String::new());
}

#[cfg(windows)]
unsafe extern "system" fn ctrl_c_ignore(evenement: u32) -> i32 {
    (evenement == windows_sys::Win32::System::Console::CTRL_C_EVENT) as i32
}

/// Relance l'outil avec les memes arguments apres une mise a jour.
fn redemarrer_application() {
    let _ = std::io::stdout().flush();
    if std::env::var("WEB_3D_RELANCEUR").as_deref() == Ok("1") {
        // Le script demarrer_* reboucle : il récupère le nouvel exécutable et le relance
        // (ce binaire-ci ne peut pas se recompiler).
        std::process::exit(75);
    }
    let lancer = || -> std::io::Result<i32> {
        let mut cmd = std::process::Command::new(std::env::current_exe()?);
        cmd.args(std::env::args_os().skip(1)).env("WEB_3D_DEJA_MAJ", "1");
        #[cfg(unix)]
        {
            // Sous Unix / macOS, exec remplace l'image du processus courant
            Err(std::os::unix::process::CommandExt::exec(&mut cmd))
        }
        #[cfg(not(unix))]
        {
            // Sous Windows, attendre l'enfant permet de conserver la fenetre console
            // ouverte (en particulier lors d'un lancement par double-clic).
            // Ctrl+C atteint aussi l'enfant, qui s'arrête proprement : on l'attend.
            #[cfg(windows)]
            unsafe {
                windows_sys::Win32::System::Console::SetConsoleCtrlHandler(Some(ctrl_c_ignore), 1);
            }
            Ok(cmd.status()?.code().unwrap_or(1))
        }
    };
    match lancer() {
        Ok(code) => std::process::exit(code),
        Err(exc) => {
            println!("[!] Erreur lors du redemarrage automatique : {}", exc);
            println!("[*] Poursuite avec le processus actuel...");
        }
    }
}

static ARRET: AtomicBool = AtomicBool::new(false);

#[cfg(unix)]
extern "C" fn sur_signal(_: libc::c_int) {
    ARRET.store(true, Ordering::SeqCst);
}

#[cfg(windows)]
unsafe extern "system" fn sur_ctrl_c(evenement: u32) -> i32 {
    if evenement != windows_sys::Win32::System::Console::CTRL_C_EVENT {
        return 0; // fenêtre fermée : le système arrête le processus
    }
    ARRET.store(true, Ordering::SeqCst);
    1
}

/// Ctrl+C demande l'arrêt.
fn ecouter_ctrl_c() {
    #[cfg(unix)]
    unsafe {
        libc::signal(libc::SIGINT, sur_signal as extern "C" fn(libc::c_int) as libc::sighandler_t);
    }
    #[cfg(windows)]
    unsafe {
        windows_sys::Win32::System::Console::SetConsoleCtrlHandler(Some(sur_ctrl_c), 1);
    }
}

const USAGE: &str = "usage: web_3d [-h] [--port PORT] [--dossier DOSSIER] [--local]\n\
                     \x20             [--sans-navigateur] [--sans-pause] [--sans-maj]\n\
                     \x20             [--projets DOSSIER]";

fn aide() {
    println!("{}\n", USAGE);
    println!("Serveur local de la visionneuse 3D.\n");
    println!("options:");
    println!("  -h, --help         show this help message and exit");
    println!("  --port PORT        port d'écoute (8139 par défaut)");
    println!("  --dossier DOSSIER  dossier à servir");
    println!("  --local            n'écouter que sur 127.0.0.1");
    println!("  --sans-navigateur  ne pas ouvrir le navigateur");
    println!("  --sans-pause       ne pas attendre de touche à l'arrêt");
    println!("  --sans-maj         ne pas vérifier les mises à jour GitHub au démarrage");
    println!("  --projets DOSSIER  dossier des projets : la page les liste et y range les");
    println!("                     modèles (WEB_SUITE y passe PROJETS/3D)");
}

/// os.path.abspath(os.path.expanduser(chemin)).
fn absolu(chemin: &str) -> PathBuf {
    let p = match chemin.strip_prefix('~') {
        Some(reste) if reste.is_empty() || reste.starts_with(['/', '\\']) => {
            appairage::dossier_personnel().join(reste.trim_start_matches(['/', '\\']))
        }
        _ => PathBuf::from(chemin),
    };
    std::path::absolute(&p).unwrap_or(p)
}

fn principal(argv: &[String]) -> i32 {
    let racine = depot();
    let mut port: u16 = 8139;
    let (mut dossier, mut projets): (Option<String>, Option<String>) = (None, None);
    let (mut local, mut sans_navigateur, mut sans_pause, mut verifier_maj) = (false, false, false, true);
    let erreur = |texte: &str| {
        eprintln!("{}\nweb_3d: error: {}", USAGE, texte);
        2
    };
    let mut args = argv.iter().map(String::as_str);
    while let Some(arg) = args.next() {
        let (nom, mut valeur) = match arg.split_once('=') {
            Some((nom, valeur)) if nom.starts_with("--") => (nom, Some(valeur)),
            _ => (arg, None),
        };
        match nom {
            "-h" | "--help" => {
                aide();
                return 0;
            }
            "--port" | "--dossier" | "--projets" => {
                let Some(v) = valeur.take().or_else(|| args.next()) else {
                    return erreur(&format!("argument {}: expected one argument", nom));
                };
                match nom {
                    "--dossier" => dossier = Some(v.to_string()),
                    "--projets" => projets = Some(v.to_string()),
                    _ => match v.parse() {
                        Ok(p) => port = p,
                        Err(_) => return erreur(&format!("argument --port: invalid int value: '{}'", v)),
                    },
                }
            }
            "--local" => local = true,
            "--sans-navigateur" => sans_navigateur = true,
            "--sans-pause" => sans_pause = true,
            "--sans-maj" => verifier_maj = false,
            _ => return erreur(&format!("unrecognized arguments: {}", arg)),
        }
        if valeur.is_some() {
            return erreur(&format!("argument {}: ignored explicit argument", nom));
        }
    }
    let projets = projets.filter(|p| !p.is_empty()).map(|p| absolu(&p));
    if let Some(p) = &projets {
        if let Err(e) = std::fs::create_dir_all(p) {
            eprintln!("Dossier des projets impossible à créer ({}) : {}", p.display(), e);
            return 1;
        }
    }

    // Sans argument ni terminal, le double-clic doit se débrouiller seul : trouver
    // un port, ouvrir la page, et laisser ses erreurs à l'écran.
    let interactif = !sans_pause && lance_par_double_clic();

    // La mise a jour d'abord : le code telecharge ne sert a rien tant que
    // c'est l'ancien qui tourne. On relance donc l'outil tel quel, avec ses
    // arguments, et le temoin d'environnement evite la boucle si la nouvelle
    // version trouve encore quelque chose a tirer.
    if verifier_maj && std::env::var("WEB_3D_DEJA_MAJ").as_deref() != Ok("1") && maj::verifier_et_appliquer_maj(&racine) {
        redemarrer_application();
    }

    let dossier = dossier.map_or_else(|| std::path::absolute(&racine).unwrap_or(racine.clone()), |d| absolu_sans_tilde(&d));
    if !dossier.join("index.html").is_file() {
        eprintln!("Aucun index.html dans {} : est-ce le bon dossier ?", dossier.display());
        attendre(interactif);
        return 2;
    }

    // Double-clic sur un .step : inscrit une fois, puis seulement si le dossier a bougé
    match ouvrir::associer(false) {
        Ok(Some(_)) => println!("Ouvrir avec : les .step et .stp de ce poste s'ouvrent dans WEB_3D"),
        Ok(None) => {}
        Err(e) => println!("Ouvrir avec : inscription impossible ({})", e), // le serveur démarre quand même
    }

    let garde = Garde::new("WEB_3D", !local, None, None);
    let serveur = match Serveur::ouvrir(port, !local, 10) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Aucun port libre entre {} et {} : {}", port, port.saturating_add(9), e);
            attendre(interactif);
            return 1;
        }
    };
    // Délai de chaque lecture du socket : un envoi coupé sans fermeture (Wi-Fi perdu) ne tient
    // pas un fil et un fichier entamé indéfiniment. Un envoi lent mais vivant n'est pas coupé.
    // WEB_3D_BANC_DELAI (bancs d'essai) : ce délai en secondes.
    serveur.regler_delai(std::env::var("WEB_3D_BANC_DELAI").ok().and_then(|d| d.parse().ok()).unwrap_or(60));
    let port_demande = port;
    let port = serveur.port();

    garde.brancher(&serveur); // en mode réseau : HTTPS sur le même port
    let url = format!("http://127.0.0.1:{}/", port);
    println!("Visionneuse 3D — serveur local");
    println!("  dossier : {}", dossier.display());
    if let Some(p) = &projets {
        println!("  projets : {}", p.display());
    }
    println!("  adresse : {}", url);
    if port != port_demande {
        println!("  (le port {} était occupé)", port_demande);
    }
    if !local {
        println!("  réseau  : {}   (tablette, autre poste)", garde.adresse(&adresse_locale(), port));
        if let Some(ip) = appairage::ip_tailscale() {
            println!("  tailscale : {}", garde.adresse(&ip.to_string(), port));
        }
        println!("            l'autre appareil demande une fois le code d'appairage ci-dessous");
        garde.annoncer();
    }
    println!("  Ctrl+C pour arrêter.\n");
    let _ = std::io::stdout().flush();

    if !sans_navigateur {
        ouvrir_navigateur(&url);
    }

    let visionneuse = serveur_3d::Visionneuse { dossier, projets, ouvrir: ouvrir::dossier(), garde, pilote: Pilote::default() };
    ecouter_ctrl_c();
    // Plusieurs requêtes à la fois : le noyau WebAssembly pèse 7 Mo, et le
    // navigateur charge le reste de la page pendant ce temps.
    serveur.servir_en_fond(Arc::new(move |r: &mut Requete| visionneuse.servir(r)));
    while !ARRET.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(100));
    }
    println!("\nArrêt du serveur.");
    serveur.arreter();

    attendre(interactif);
    0
}

fn absolu_sans_tilde(chemin: &str) -> PathBuf {
    std::path::absolute(Path::new(chemin)).unwrap_or_else(|_| PathBuf::from(chemin))
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match args.first().map(String::as_str) {
        Some("ouvrir") => ouvrir::principal(&args[1..]),
        _ => principal(&args),
    };
    std::process::exit(code);
}
