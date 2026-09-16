#!/usr/bin/env python3
# =============================================================================
# Visionneuse 3D — serveur.py
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
    allow_reuse_address = True
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


def main() -> int:
    ap = argparse.ArgumentParser(description="Serveur local de la visionneuse 3D.")
    ap.add_argument("--port", type=int, default=8139, help="port d'écoute (8139 par défaut)")
    ap.add_argument("--dossier", default=RACINE, help="dossier à servir")
    ap.add_argument("--local", action="store_true", help="n'écouter que sur 127.0.0.1")
    ap.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    ap.add_argument("--sans-pause", action="store_true", help="ne pas attendre de touche à l'arrêt")
    args = ap.parse_args()

    dossier = os.path.abspath(args.dossier)
    if not os.path.isfile(os.path.join(dossier, "index.html")):
        print(f"Aucun index.html dans {dossier} : est-ce le bon dossier ?", file=sys.stderr)
        return 2

    os.chdir(dossier)
    hote = "127.0.0.1" if args.local else "0.0.0.0"

    try:
        serveur = Serveur((hote, args.port), Gestionnaire)
    except OSError as e:
        print(f"Impossible d'écouter sur le port {args.port} : {e}", file=sys.stderr)
        print("Un autre serveur l'occupe peut-être. Essayez --port 8140.", file=sys.stderr)
        return 1

    url = f"http://127.0.0.1:{args.port}/"
    print("Visionneuse 3D — serveur local")
    print(f"  dossier : {dossier}")
    print(f"  adresse : {url}")
    if not args.local:
        print(f"  réseau  : http://{adresse_locale()}:{args.port}/   (tablette, autre poste)")
    print("  Ctrl+C pour arrêter.\n")

    if not args.sans_navigateur:
        webbrowser.open(url)

    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
    finally:
        serveur.server_close()

    if not args.sans_pause and os.name == "nt" and sys.stdin.isatty():
        input("Appuyez sur Entrée pour fermer…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
