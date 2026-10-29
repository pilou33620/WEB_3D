#!/usr/bin/python3
"""Ouvrir un fichier STEP de ce poste dans WEB_3D, depuis le gestionnaire de fichiers.

    python3 ouvrir.py piece.step     copie le fichier, démarre WEB_3D s'il le faut, ouvre la page
    python3 ouvrir.py --associer     ajoute « Ouvrir avec WEB_3D » aux .step/.stp (cet utilisateur)

Le fichier est copié dans ~/.web_tools/ouvrir/ (servi au seul poste par web_3D.py, route
/ouvrir/) et seulement affiché : le bouton « Ranger » de la page le garde dans PROJETS.
Un WEB_3D déjà ouvert sert tel quel ; sinon il démarre par le lanceur de WEB_SUITE quand
WEB_3D en fait partie (../lanceur), seul sinon, dans sa propre fenêtre.
"""
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import webbrowser

ICI = os.path.dirname(os.path.abspath(__file__))
DOSSIER = os.path.join(os.path.expanduser("~"), ".web_tools", "ouvrir")
EXTENSIONS = (".step", ".stp")
LANCEUR = os.path.join(os.path.dirname(ICI), "lanceur", "web_suite.py")
PORT_LANCEUR, PORT_3D = 8100, 8139           # les défauts ; chacun prend le suivant si occupé
GARDE_COPIES = 24 * 3600                     # s : les copies plus vieilles sont retirées
WINDOWS = os.name == "nt"
# 127.0.0.1 ne doit jamais passer par un proxy (http_proxy de l'environnement)
OUVREUR = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def nom_sur(chemin):
    """Le nom que le serveur accepte (NOM_PROJET de web_3D.py) et que ?modele= ne coupe pas
    (la virgule y sépare les fichiers)."""
    base, ext = os.path.splitext(os.path.basename(chemin))
    base = re.sub(r"[^\w .()+-]", "_", base).strip() or "modele"
    return ("" if re.match(r"[\w(]", base) else "_") + base + ext.lower()


def copier(source):
    os.makedirs(DOSSIER, mode=0o700, exist_ok=True)
    limite = time.time() - GARDE_COPIES
    for ancien in os.scandir(DOSSIER):
        if ancien.is_file(follow_symlinks=False) and ancien.stat(follow_symlinks=False).st_mtime < limite:
            os.remove(ancien.path)
    nom = nom_sur(source)
    cible = os.path.join(DOSSIER, nom)
    shutil.copyfile(source, cible + ".part")  # .part n'est jamais servi : pas de fichier à moitié lu
    os.replace(cible + ".part", cible)
    return nom


def lire(url, corps=None, delai=3):
    req = urllib.request.Request(url, None if corps is None else json.dumps(corps).encode(),
                                 {"X-WebSuite": "1", "Content-Type": "application/json"})
    with OUVREUR.open(req, timeout=delai) as r:
        return json.load(r)


def trouver(depart, chemin, cle):
    """Le port, parmi les 10 que le serveur essaie, où `chemin` rend un JSON avec `cle`."""
    for port in range(depart, depart + 10):
        try:
            if cle in lire("http://127.0.0.1:%d%s" % (port, chemin), delai=1):
                return port
        except (OSError, ValueError):
            pass
    return None


def attendre(test, delai, quoi):
    fin = time.time() + delai
    while time.time() < fin:
        try:
            r = test()
        except (OSError, ValueError):
            r = None
        if r:
            return r
        time.sleep(0.5)
    raise RuntimeError("%s ne répond pas après %d s." % (quoi, delai))


def demarrer(script, *args):
    """Lance un serveur dans sa propre fenêtre : on y voit ses messages, la fermer l'arrête."""
    exe = sys.executable
    if WINDOWS:   # lancé par pythonw (association) : python.exe pour avoir une console
        exe = os.path.join(os.path.dirname(exe), "python.exe") if exe.lower().endswith("pythonw.exe") else exe
        subprocess.Popen([exe, script, *args], cwd=os.path.dirname(script),
                         creationflags=subprocess.CREATE_NEW_CONSOLE)
    elif shutil.which("x-terminal-emulator"):
        subprocess.Popen(["x-terminal-emulator", "-e", shlex.join([exe, script, *args])],
                         cwd=os.path.dirname(script), start_new_session=True)
    else:
        subprocess.Popen([exe, script, *args], cwd=os.path.dirname(script), stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def port_web3d():
    port = trouver(PORT_3D, "/api/projets", "dispo")
    if port:
        return port
    if not os.path.isfile(LANCEUR):
        demarrer(os.path.join(ICI, "web_3D.py"), "--sans-navigateur")
        return attendre(lambda: trouver(PORT_3D, "/api/projets", "dispo"), 120, "WEB_3D")
    lanceur = trouver(PORT_LANCEUR, "/api/etat", "outils")
    if not lanceur:
        demarrer(LANCEUR, "--sans-navigateur")
        # le lanceur vérifie les mises à jour de la suite et des outils avant de répondre
        lanceur = attendre(lambda: trouver(PORT_LANCEUR, "/api/etat", "outils"), 180, "WEB_SUITE")
    api = "http://127.0.0.1:%d/api/" % lanceur
    lire(api + "lancer", {"id": "web_3d"}, delai=120)

    def actif():
        o = next(o for o in lire(api + "etat")["outils"] if o["id"] == "web_3d")
        if o["phase"] == "erreur":
            raise RuntimeError("WEB_3D : " + o["message"])
        return o["phase"] == "actif" and o["port"]
    return attendre(actif, 120, "WEB_3D")


def associer():
    script = os.path.abspath(__file__)
    if WINDOWS:
        import ctypes
        import winreg
        pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        commande = '"%s" "%s" "%%1"' % (pyw if os.path.isfile(pyw) else sys.executable, script)
        cles = winreg.HKEY_CURRENT_USER
        winreg.SetValue(cles, r"Software\Classes\WEB3D.step", winreg.REG_SZ, "Modèle STEP (WEB_3D)")
        winreg.SetValue(cles, r"Software\Classes\WEB3D.step\shell\open\command", winreg.REG_SZ, commande)
        for ext in EXTENSIONS:
            with winreg.CreateKey(cles, r"Software\Classes\%s\OpenWithProgids" % ext) as k:
                winreg.SetValueEx(k, "WEB3D.step", 0, winreg.REG_NONE, b"")
        ctypes.windll.shell32.SHChangeNotify(0x08000000, 0, None, None)   # SHCNE_ASSOCCHANGED
        return ("Clic droit sur un .step → Ouvrir avec → « Choisir une autre application » → WEB_3D,"
                " puis « Toujours » pour le double-clic.")
    partage = os.path.join(os.path.expanduser("~"), ".local", "share")
    os.makedirs(os.path.join(partage, "mime", "packages"), exist_ok=True)
    os.makedirs(os.path.join(partage, "applications"), exist_ok=True)
    with open(os.path.join(partage, "mime", "packages", "web3d-step.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">\n'
                '  <mime-type type="model/step"><comment>Modèle STEP</comment>'
                '<glob pattern="*.step"/><glob pattern="*.stp"/></mime-type>\n</mime-info>\n')
    guillemets = lambda p: '"%s"' % re.sub(r'(["`$\\])', r"\\\1", p)   # Exec= du format .desktop
    with open(os.path.join(partage, "applications", "web3d-ouvrir.desktop"), "w", encoding="utf-8") as f:
        f.write("[Desktop Entry]\nType=Application\nName=WEB_3D\nComment=Voir le modèle dans WEB_3D\n"
                "Exec=%s %s %%f\nMimeType=model/step;\nTerminal=false\nNoDisplay=true\n"
                % (guillemets(sys.executable), guillemets(script)))
    for cmd in (["update-mime-database", os.path.join(partage, "mime")],
                ["update-desktop-database", os.path.join(partage, "applications")],
                ["xdg-mime", "default", "web3d-ouvrir.desktop", "model/step"]):
        if shutil.which(cmd[0]):
            subprocess.run(cmd, stdin=subprocess.DEVNULL, timeout=60, check=False)
    return "Les .step et .stp s'ouvrent maintenant dans WEB_3D (double-clic ou Ouvrir avec)."


def dire(texte):
    """Lancé par le gestionnaire de fichiers, sans terminal : le message passe par une fenêtre."""
    print(texte, flush=True)
    if sys.stdout is None or not sys.stdout.isatty():
        try:
            import tkinter
            from tkinter import messagebox
            tkinter.Tk().withdraw()
            messagebox.showinfo("WEB_3D", texte)
        except Exception:   # pas de tkinter ni d'écran : le message reste dans la sortie
            pass


def main(argv):
    try:
        if argv == ["--associer"]:
            dire(associer())
            return 0
        if len(argv) != 1 or not argv[0].lower().endswith(EXTENSIONS) or not os.path.isfile(argv[0]):
            dire("Usage : ouvrir.py fichier.step (ou .stp) | --associer")
            return 2
        nom = copier(argv[0])
        port = port_web3d()
        webbrowser.open("http://127.0.0.1:%d/?modele=%s" % (port, urllib.parse.quote("/ouvrir/" + nom)))
        return 0
    except (OSError, RuntimeError) as e:
        dire("Impossible d'ouvrir dans WEB_3D : %s" % e)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
