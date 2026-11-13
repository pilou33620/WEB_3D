"""Banc du serveur : ce qu'il sert, ce qu'il refuse.

    python test/banc-serveur.py

Démarre l'exécutable web_3d (boîte noire : sous-processus et HTTP) sur un port
libre de 127.0.0.1 et vérifie que la page, le noyau WebAssembly et les exemples
se chargent, que rien d'autre du dossier ne sort (.git, sources, listes de
fichiers) et qu'un Host étranger est refusé (DNS rebinding).

Ce qui ne se voit pas de l'extérieur (noms sûrs et copie de « ouvrir », chemins des
projets, mise à jour git) est vérifié par cargo test.
"""
import http.client
import os
import re
import subprocess
import sys
import tempfile

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)
from banc_bin import binaire  # noqa: E402

# Le dossier personnel du serveur : l'inscription « Ouvrir avec » et ~/.web_tools/ouvrir/
# restent dans un dossier d'essai
MAISON = tempfile.TemporaryDirectory()
os.makedirs(os.path.join(MAISON.name, ".config"))
JOURNAL = open(os.path.join(MAISON.name, "erreurs.txt"), "w+")
LANCES = []


def demarrer(*args, **env):
    """Lance web_3d sur un port libre : (port, ce qu'il a écrit avant de servir)."""
    milieu = {k: v for k, v in os.environ.items() if k not in ("XDG_CONFIG_HOME", "XDG_DATA_HOME")}
    milieu.update(HOME=MAISON.name, USERPROFILE=MAISON.name, WEB_3D_DEPOT=RACINE, **env)
    proc = subprocess.Popen([binaire("web_3d"), "--local", "--sans-navigateur", "--sans-maj", "--sans-pause",
                             "--port", "0", *args], stdout=subprocess.PIPE, stderr=JOURNAL, env=milieu,
                            encoding="utf-8")
    LANCES.append(proc)
    lignes = []
    while not lignes or "Ctrl+C" not in lignes[-1]:
        ligne = proc.stdout.readline()
        if not ligne:
            raise SystemExit("web_3d s'est arrêté au démarrage :\n" + "".join(lignes))
        lignes.append(ligne)
    return int(re.search(r"adresse : http://127\.0\.0\.1:(\d+)/", "".join(lignes)).group(1)), "".join(lignes)


def arreter(proc):
    proc.terminate()
    proc.wait(10)
    proc.stdout.close()


PORT, ANNONCE = demarrer()


def code(chemin, hote=None, methode="GET"):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
    c.putrequest(methode, chemin, skip_host=True)
    c.putheader("Host", hote or "127.0.0.1:%d" % PORT)
    c.endheaders()
    r = c.getresponse()
    r.read()
    c.close()
    return r.status


CAS = [
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
    ("/", "192.168.1.20:8139", 200),
    ("/", "localhost:8139", 200),
    ("/", "evil.example:8139", 403),
]

echecs = 0
for chemin, hote, attendu in CAS:
    obtenu = code(chemin, hote)
    if obtenu != attendu:
        echecs += 1
        print("ECHEC %-36s Host=%-20s attendu %d, obtenu %d"
              % (chemin, hote, attendu, obtenu))
if code("/.git/config", methode="HEAD") != 404:
    echecs += 1
    print("ECHEC HEAD /.git/config")


# --- Projets (--projets) : lister, ranger, relire, sans sortir du dossier ---
import json      # noqa: E402
import tempfile  # noqa: E402


def requete(methode, chemin, corps=None, entetes=None):
    c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
    c.request(methode, chemin, body=corps, headers=entetes or {})
    r = c.getresponse()
    donnees = r.read()
    c.close()
    return r.status, donnees


def verifier(nom, obtenu, attendu):
    global echecs, essais
    essais += 1
    if obtenu != attendu:
        echecs += 1
        print("ECHEC %s : attendu %r, obtenu %r" % (nom, attendu, obtenu))


essais = len(CAS) + 1
verifier("sans --projets : pas de projets", json.loads(requete("GET", "/api/projets")[1])["dispo"], False)
with tempfile.TemporaryDirectory() as tmp:
    # un second serveur, avec --projets ; son délai de lecture du socket est d'une seconde
    PORT_SANS, (PORT, ANNONCE_2) = PORT, demarrer("--projets", tmp, WEB_3D_BANC_DELAI="1")
    with open(os.path.join(tmp, "secret.txt"), "w") as f:
        f.write("non")
    stl = open(os.path.join(RACINE, "exemples", "tetraedre.stl"), "rb").read()
    ranger = lambda nom, h={"X-Web3D": "1"}: requete("POST", "/api/projets?nom=" + nom, stl, h)
    verifier("rangement sans X-Web3D", ranger("t.stl", {})[0], 403)
    verifier("rangement d'un .txt", ranger("x.txt")[0], 400)
    verifier("nom qui remonte : gardé dans le dossier", json.loads(ranger("..%2F..%2Ft.stl")[1]).get("chemin"), "t.stl")
    verifier("pas d'écrasement", json.loads(ranger("t.stl")[1])["chemin"], "t (2).stl")
    liste = json.loads(requete("GET", "/api/projets")[1])
    verifier("liste", (liste["dispo"], sorted(f["chemin"] for f in liste["fichiers"])), (True, ["t (2).stl", "t.stl"]))
    verifier("relecture", requete("GET", "/projets/t.stl")[1], stl)
    for nom in ("m.glb", "m.gltf"):       # la page les ouvre : ils se rangent aussi
        verifier("rangement " + nom, json.loads(ranger(nom)[1]).get("chemin"), nom)
        verifier("relecture " + nom, requete("GET", "/projets/" + nom)[1], stl)
        os.remove(os.path.join(tmp, nom))
    for chemin in ("/projets/secret.txt", "/projets/../Cargo.toml", "/projets/..%5cCargo.toml",
                   "/projets/C:%5cWindows%5cwin.ini", "/projets/.git/config"):
        verifier("refus " + chemin, requete("GET", chemin)[0], 404)

    # Pièces du mode conception : remplacement explicite, réservé aux .json, atomique
    piece = lambda corps, nom="p.json", rem="&remplacer=1": requete("POST", "/api/projets?nom=" + nom + rem, corps, {"X-Web3D": "1"})
    verifier("pièce .json rangée", json.loads(piece(b'{"v":1}', rem="")[1])["chemin"], "p.json")
    verifier("pièce .json remplacée sur demande", (json.loads(piece(b'{"v":2}')[1])["chemin"],
             requete("GET", "/projets/p.json")[1]), ("p.json", b'{"v":2}'))
    verifier("remplacement refusé hors .json", piece(stl, "t.stl")[0], 400)
    verifier("remplacement : nom qui remonte refusé", piece(b"{}", "..%2Fp.json")[0], 400)
    verifier("remplacement : sous-dossier absent refusé", piece(b"{}", "absent%2Fp.json")[0], 400)
    verifier("remplacement : aucun .tmp laissé", [f for f in os.listdir(tmp) if f.endswith(".tmp")], [])
    verifier("page de conception servie", requete("GET", "/conception.html")[0], 200)
    verifier("règles de conception servies", requete("GET", "/regles-conception.md")[0], 200)
    verifier("seul ce .md est servi", requete("GET", "/README.md")[0], 404)

    # Un lien symbolique « piege.stl.part » déposé dans PROJETS (dépôt synchronisé) ne fait
    # pas écrire ailleurs : l'écriture va dans la cible, créée en exclusif, sans suivre de lien
    with tempfile.TemporaryDirectory() as dehors:
        victime = os.path.join(dehors, "victime.txt")
        with open(victime, "w") as f:
            f.write("intact")
        os.symlink(victime, os.path.join(tmp, "piege.stl.part"))
        verifier("lien .part piégé : rangé quand même", json.loads(ranger("piege.stl")[1])["chemin"], "piege.stl")
        verifier("lien .part piégé : rien écrit dehors", open(victime).read(), "intact")
        verifier("lien .part piégé : un vrai fichier", os.path.islink(os.path.join(tmp, "piege.stl")), False)
        # Liens morts ou vers l'extérieur : ni listés, ni cause d'erreur
        os.symlink(os.path.join(dehors, "absent.stl"), os.path.join(tmp, "mort.stl"))
        os.symlink(victime, os.path.join(tmp, "dehors.stl"))
        statut, corps = requete("GET", "/api/projets")
        chemins = [f["chemin"] for f in json.loads(corps)["fichiers"]] if statut == 200 else None
        verifier("liens symboliques ignorés par la liste", (statut, "mort.stl" in (chemins or []),
                 "dehors.stl" in (chemins or [])), (200, False, False))

    # Deux rangements simultanés du même nom : deux fichiers, chacun intact (jamais d'écrasement)
    import threading as _t
    corps_ab = {"A": b"A" * (2 << 20), "B": b"B" * (2 << 20)}
    rendus = {}
    fils = [_t.Thread(target=lambda k=k: rendus.update({k: requete("POST", "/api/projets?nom=course.stl", corps_ab[k],
                                                                    {"X-Web3D": "1"})})) for k in "AB"]
    for f in fils: f.start()
    for f in fils: f.join(30)
    chemins = {k: json.loads(r[1])["chemin"] for k, r in rendus.items() if r[0] == 200}
    verifier("course : deux réponses 200, deux noms", (len(chemins), len(set(chemins.values()))), (2, 2))
    verifier("course : chaque fichier a son propre contenu",
             all(open(os.path.join(tmp, c), "rb").read() == corps_ab[k] for k, c in chemins.items()), True)

    verifier("annexes de la page (.webp, .bmp, .gif) rangées", [ranger("t." + e)[0] for e in ("webp", "bmp", "gif")],
             [200, 200, 200])

    # Envoi coupé : fin prématurée (le client ferme) ou client muet au-delà du délai : aucun fichier tronqué
    import socket as _s  # noqa: E402
    import time as _tm   # noqa: E402

    def envoi_partiel(nom, fermer):
        s = _s.create_connection(("127.0.0.1", PORT), timeout=10)
        s.sendall(("POST /api/projets?nom=%s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nX-Web3D: 1\r\n"
                   "Content-Length: 100000\r\n\r\n" % (nom, PORT)).encode() + b"x" * 10)
        if fermer:
            s.shutdown(_s.SHUT_WR)
            reponse = s.recv(100)
        else:   # le fichier entamé apparaît, puis disparaît au bout du délai
            fin, existe = _tm.monotonic() + 5, lambda: os.path.exists(os.path.join(tmp, nom))
            while not existe() and _tm.monotonic() < fin:
                _tm.sleep(0.02)
            reponse = b"entame" if existe() else b""
            while existe() and _tm.monotonic() < fin:
                _tm.sleep(0.05)
        s.close()
        return reponse, os.path.exists(os.path.join(tmp, nom))

    verifier("envoi coupé : 400 et fichier retiré", envoi_partiel("coupe.stl", True)[0][9:12] + b"/" +
             str(os.path.exists(os.path.join(tmp, "coupe.stl"))).encode(), b"400/False")
    verifier("client muet au-delà du délai : fichier retiré", envoi_partiel("muet.stl", False), (b"entame", False))
    arreter(LANCES[-1])
    PORT = PORT_SANS

# Canal de pilotage (pilote.rs de web_suite, MCP) : X-Web3D exigé sur tout POST, le pilote
# refuse en plus une autre origine ; la page bat, le MCP de ce poste voit l'onglet
import json  # noqa: E402
battement = json.dumps({"navigateur": "n1", "onglets": [{"id": "o1", "page": "3d", "projet": "", "focus_il_y_a": 0}]})
verifier("pilote : sans X-Web3D, battement refusé", requete("POST", "/api/pilote/battement", battement,
                                                           {"Content-Type": "application/json"})[0], 403)
verifier("pilote : sans X-Web3D, aucun onglet noté",
         json.loads(requete("GET", "/api/pilote/onglets")[1])["onglets"], [])
json_ = {"Content-Type": "application/json", "X-Web3D": "1"}
verifier("pilote : autre origine refusée", requete("POST", "/api/pilote/battement", battement,
                                                   dict(json_, Origin="http://evil.example"))[0], 403)
verifier("pilote : battement de la page", requete("POST", "/api/pilote/battement", battement,
                                                  dict(json_, Origin="http://127.0.0.1:%d" % PORT))[0], 200)
verifier("pilote : onglet vu par le MCP",
         [o["id"] for o in json.loads(requete("GET", "/api/pilote/onglets")[1])["onglets"]], ["o1"])
verifier("pilote : fichiers de la page servis", (code("/js/pilote.js"), code("/css/pilote.css")), (200, 200))
_c = http.client.HTTPConnection("127.0.0.1", PORT, timeout=10)
_c.request("GET", "/")
_r = _c.getresponse(); _r.read(); _c.close()
verifier("cadres : même origine seulement", (_r.getheader("X-Frame-Options"),
         "frame-ancestors 'self'" in (_r.getheader("Content-Security-Policy") or "")), ("SAMEORIGIN", True))

# Ouvrir depuis le gestionnaire de fichiers (web_3d ouvrir) : la copie est servie au seul poste.
# Les noms sûrs et la copie elle-même (vieilles copies retirées) : cargo test, ouvrir.rs.
import urllib.parse  # noqa: E402
nom = "Pièce_ v2.step"
os.makedirs(os.path.join(MAISON.name, ".web_tools", "ouvrir"))
with open(os.path.join(MAISON.name, ".web_tools", "ouvrir", nom), "wb") as f:
    f.write(b"ISO-10303-21;")
url = "/ouvrir/" + urllib.parse.quote(nom)
verifier("ouvrir : servi au poste", requete("GET", url)[1], b"ISO-10303-21;")
for chemin in ("/ouvrir/../Cargo.toml", "/ouvrir/..%2F..%2Fsecret.stp", "/ouvrir/.part"):
    verifier("ouvrir : refus " + chemin, requete("GET", chemin)[0], 404)
# WEB_TOOLS_BANC_DISTANT=1 : ce serveur-là traite le poste comme un autre appareil
PORT_POSTE, (PORT, ANNONCE_3) = PORT, demarrer(WEB_TOOLS_BANC_DISTANT="1")
verifier("ouvrir : refusé à un autre appareil", (requete("GET", url)[0], requete("GET", "/")[0]), (404, 200))
arreter(LANCES[-1])
PORT = PORT_POSTE
if os.name != "nt":   # inscription au démarrage : une fois, puis rien tant que le dossier ne bouge pas
    verifier("associer : la première fois, puis plus", ["Ouvrir avec :" in a for a in (ANNONCE, ANNONCE_2, ANNONCE_3)],
             [True, False, False])
    entree = os.path.join(MAISON.name, ".local", "share", "applications", "web3d-ouvrir.desktop")
    verifier("associer : l'entrée lance « web_3d ouvrir »",
             'Exec="%s" ouvrir %%f\n' % os.path.realpath(binaire("web_3d")) in open(entree, encoding="utf-8").read(), True)

# --- Un client coupé en pleine réponse n'est pas une erreur à afficher, et le serveur continue ---
import socket as _s2  # noqa: E402
import struct  # noqa: E402
for _ in range(3):
    s = _s2.create_connection(("127.0.0.1", PORT), timeout=10)
    s.sendall(("GET /vendor/occt/occt-import-js.wasm HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n\r\n" % PORT).encode())
    s.recv(1000)
    s.setsockopt(_s2.SOL_SOCKET, _s2.SO_LINGER, struct.pack("hh" if os.name == "nt" else "ii", 1, 0))   # RST à la fermeture
    s.close()
verifier("client coupé : le serveur sert toujours", code("/conception.html"), 200)
JOURNAL.flush()
JOURNAL.seek(0)
erreurs = JOURNAL.read()
verifier("client coupé : rien d'affiché", [l for l in erreurs.splitlines() if "panicked" in l or "occt-import" in l], [])
verifier("journal : les refus y sont, pas les lectures réussies",
         ('"GET /.git/config" 404' in erreurs, '"GET /index.html" 200' in erreurs), (True, False))

for proc in LANCES[:1]:
    arreter(proc)
JOURNAL.close()
MAISON.cleanup()
print("%d/%d ok" % (essais - echecs, essais))
sys.exit(1 if echecs else 0)
