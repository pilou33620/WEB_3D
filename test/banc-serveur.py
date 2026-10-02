"""Banc du serveur : ce qu'il sert, ce qu'il refuse.

    python test/banc-serveur.py

Démarre le serveur en mémoire sur un port libre de 127.0.0.1 et vérifie que
la page, le noyau WebAssembly et les exemples se chargent, que rien d'autre du
dossier ne sort (.git, script, listes de fichiers) et qu'un Host étranger est
refusé (DNS rebinding).
"""
import http.client
import os
import sys
import threading

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)
os.chdir(RACINE)
import web_3D  # noqa: E402

serveur = web_3D.Serveur(("127.0.0.1", 0), web_3D.Gestionnaire)
threading.Thread(target=serveur.serve_forever, daemon=True).start()
PORT = serveur.server_address[1]


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
    ("/web_3D.py", None, 404),
    ("/README.md", None, 404),
    ("/js/", None, 404),
    ("/exemples/", None, 404),
    ("/js/../web_3D.py", None, 404),
    ("/js/%2e%2e/web_3D.py", None, 404),
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
    web_3D.PROJETS = tmp
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
    for chemin in ("/projets/secret.txt", "/projets/../web_3D.py", "/projets/..%5cweb_3D.py",
                   "/projets/C:%5cWindows%5cwin.ini", "/projets/.git/config"):
        verifier("refus " + chemin, requete("GET", chemin)[0], 404)
    web_3D.PROJETS = None

serveur.shutdown()
print("%d/%d ok" % (essais - echecs, essais))
sys.exit(1 if echecs else 0)
