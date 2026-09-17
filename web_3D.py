#!/usr/bin/python3
# =============================================================================
# Visionneuse 3D — web_3D.py
#
# PAS « /usr/bin/env python3 » DANS LA PREMIERE LIGNE. Sous Windows, le
# double-clic passe par py.exe, qui lit ce shebang : « env » lui fait chercher
# python3.exe dans le PATH, où il ne trouve que l'alias du Microsoft Store —
# lequel affiche « Python est introuvable » et rend la main aussitôt. La
# fenêtre se refermait donc avant d'avoir rien lancé. « /usr/bin/python3 » est
# un nom que py.exe reconnaît et fait pointer sur le Python installé ; sous
# Linux et macOS c'est un chemin réel, et Pyto ignore la ligne.
#
# Un serveur de fichiers statiques, et rien d'autre : la lecture des fichiers
# CAO se fait entièrement dans le navigateur. Il n'existe que pour deux raisons.
#
#   1. WebAssembly. Le noyau OpenCascade est chargé par `fetch` ; en `file://`
#      le navigateur refuse la requête (origine « null »). Il faut donc du HTTP,
#      même en local.
#   2. Le type MIME `application/wasm`. Sans lui, Chrome et Firefox refusent la
#      compilation en continu du module — et se contentent d'un message obscur
#      dans la console.
#
# Bibliothèque standard uniquement : le script tourne tel quel sous Windows,
# Linux, macOS, et sous Pyto sur iPad comme le reste de la suite.
# =============================================================================

import argparse
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

RACINE = os.path.dirname(os.path.abspath(__file__))


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    """Sert le dossier de la visionneuse, avec les types MIME qui manquent."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".stp": "application/octet-stream",
        ".step": "application/octet-stream",
        ".igs": "application/octet-stream",
        ".iges": "application/octet-stream",
        ".brep": "application/octet-stream",
        ".stl": "application/octet-stream",
        ".3mf": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
        ".obj": "text/plain",
        ".mtl": "text/plain",
        ".glb": "model/gltf-binary",
    }

    def end_headers(self):
        # En développement, un fichier modifié doit être servi modifié : le cache
        # du navigateur ferait perdre plus de temps qu'il n'en fait gagner.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, format, *args):
        # Le journal par défaut noie les erreurs sous les requêtes réussies.
        if not args or not str(args[0]).startswith(("GET", "HEAD")) or str(args[1]) != "200":
            super().log_message(format, *args)


class Serveur(socketserver.ThreadingTCPServer):
    """Plusieurs requêtes à la fois : le noyau WebAssembly pèse 7 Mo, et le
    navigateur charge le reste de la page pendant ce temps."""
    # SO_REUSEADDR évite le TIME_WAIT sous Unix ; sous Windows il permet à deux
    # serveurs de se poser sur le même port, et le second vole la moitié des
    # requêtes sans rien dire. Là-bas, mieux vaut l'échec franc : on change de
    # port (voir ouvrir_serveur).
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


def adresse_locale() -> str:
    """Adresse de la machine sur le réseau, pour ouvrir la page sur une tablette."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))     # aucun paquet n'est envoyé
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


# Les executables qui peuvent se trouver sur la console d'un double-clic sans
# que personne n'ait rien tape : l'association Windows des .py passe par
# py.exe, qui lance python.exe et attend -- les deux sont donc attaches.
LANCEURS_PYTHON = ("py.exe", "pyw.exe", "python.exe", "pythonw.exe",
                   "python3.exe", "python3w.exe")


def processus_de_la_console():
    """Noms des executables attaches a la console, le notre compris.

    Renvoie () quand la question n'a pas de reponse sure -- pas de console, ou
    un processus qu'on n'a pas le droit de nommer. L'appelant doit alors s'en
    tenir au comportement par defaut plutot que de deviner.
    """
    import ctypes
    from ctypes import wintypes

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.GetConsoleProcessList.argtypes = [ctypes.POINTER(wintypes.DWORD),
                                          wintypes.DWORD]
    k32.GetConsoleProcessList.restype = wintypes.DWORD
    taille = 16
    tampon = (wintypes.DWORD * taille)()
    combien = k32.GetConsoleProcessList(tampon, taille)
    if not combien or combien > taille:
        return ()

    k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k32.OpenProcess.restype = wintypes.HANDLE
    k32.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD)]
    k32.QueryFullProcessImageNameW.restype = wintypes.BOOL
    k32.CloseHandle.argtypes = [wintypes.HANDLE]

    noms = []
    for pid in tampon[:combien]:
        handle = k32.OpenProcess(0x1000, False, pid)   # QUERY_LIMITED_INFORMATION
        if not handle:
            return ()
        try:
            longueur = wintypes.DWORD(32768)
            chemin = ctypes.create_unicode_buffer(longueur.value)
            if not k32.QueryFullProcessImageNameW(handle, 0, chemin,
                                                  ctypes.byref(longueur)):
                return ()
            noms.append(os.path.basename(chemin.value).lower())
        finally:
            k32.CloseHandle(handle)
    return tuple(noms)


def lance_par_double_clic():
    """Vrai quand Windows a cree la console POUR ce script -- c'est-a-dire
    quand il a ete lance depuis l'Explorateur.

    Elle sert a retenir la fenetre : sans cela, une erreur de demarrage
    disparait avec elle, et l'outil a « juste rien fait ».

    COMMENT ON LE SAIT. Un terminal laisse son shell attache a la console :
    cmd.exe, powershell.exe, bash.exe y figurent a cote de nous. Un
    double-clic, lui, ne fait venir que Python -- et pas un seul processus,
    car l'association des .py passe par py.exe, qui lance python.exe et
    attend. Compter les processus ne suffisait donc pas : on les nomme.
    """
    if os.name != "nt":
        return False
    try:
        noms = processus_de_la_console()
    except Exception:                                  # noqa: BLE001
        return False
    return bool(noms) and all(n in LANCEURS_PYTHON for n in noms)


def attendre(interactif: bool) -> None:
    """Retient la fenêtre le temps de lire ce qui vient d'être écrit."""
    if not interactif:
        return
    try:
        input("\nAppuyez sur Entrée pour fermer…")
    except EOFError:
        pass


def ouvrir_serveur(hote: str, port: int, essais: int):
    """Le premier port libre à partir de `port`. Un double-clic ne doit pas
    échouer simplement parce qu'un serveur de la veille occupe encore 8139."""
    derniere: OSError | None = None
    for p in range(port, port + essais):
        try:
            return Serveur((hote, p), Gestionnaire), p
        except OSError as e:
            derniere = e
    raise derniere


def main() -> int:
    ap = argparse.ArgumentParser(description="Serveur local de la visionneuse 3D.")
    ap.add_argument("--port", type=int, default=8139, help="port d'écoute (8139 par défaut)")
    ap.add_argument("--dossier", default=RACINE, help="dossier à servir")
    ap.add_argument("--local", action="store_true", help="n'écouter que sur 127.0.0.1")
    ap.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    ap.add_argument("--sans-pause", action="store_true", help="ne pas attendre de touche à l'arrêt")
    args = ap.parse_args()

    # Sans argument ni terminal, le double-clic doit se débrouiller seul : trouver
    # un port, ouvrir la page, et laisser ses erreurs à l'écran.
    interactif = not args.sans_pause and lance_par_double_clic()

    dossier = os.path.abspath(args.dossier)
    if not os.path.isfile(os.path.join(dossier, "index.html")):
        print(f"Aucun index.html dans {dossier} : est-ce le bon dossier ?", file=sys.stderr)
        attendre(interactif)
        return 2

    os.chdir(dossier)
    hote = "127.0.0.1" if args.local else "0.0.0.0"

    try:
        serveur, port = ouvrir_serveur(hote, args.port, 10)
    except OSError as e:
        print(f"Aucun port libre entre {args.port} et {args.port + 9} : {e}", file=sys.stderr)
        attendre(interactif)
        return 1

    url = f"http://127.0.0.1:{port}/"
    print("Visionneuse 3D — serveur local")
    print(f"  dossier : {dossier}")
    print(f"  adresse : {url}")
    if port != args.port:
        print(f"  (le port {args.port} était occupé)")
    if not args.local:
        print(f"  réseau  : http://{adresse_locale()}:{port}/   (tablette, autre poste)")
    print("  Ctrl+C pour arrêter.\n")

    if not args.sans_navigateur:
        webbrowser.open(url)

    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
    finally:
        serveur.server_close()

    attendre(interactif)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
