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
    web_3D.PROJETS = None

# Canal de pilotage (pilote.py, MCP de web_suite) : WEB_3D n'a pas de garde CSRF, c'est
# pilote.py qui refuse une autre origine ; la page bat, le MCP de ce poste voit l'onglet
import json  # noqa: E402
battement = json.dumps({"navigateur": "n1", "onglets": [{"id": "o1", "page": "3d", "projet": "", "focus_il_y_a": 0}]})
json_ = {"Content-Type": "application/json"}
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

serveur.shutdown()
print("%d/%d ok" % (essais - echecs, essais))
sys.exit(1 if echecs else 0)
