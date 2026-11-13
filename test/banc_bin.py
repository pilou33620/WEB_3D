"""Les bancs d'essai (Python) pilotent l'exécutable Rust : où le trouver.

    from banc_bin import binaire
    proc = subprocess.Popen([binaire("web_3d"), "--port", "0", ...])

WEB_3D_BIN donne un dossier d'exécutables déjà compilés (CI) ; sinon cargo
build le (re)compile une fois, dans target/debug.
"""
import os
import subprocess
import sys

DEPOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_compile = False


def binaire(nom="web_3d"):
    """Chemin de l'exécutable Rust `nom`."""
    global _compile
    exe = nom + (".exe" if os.name == "nt" else "")
    dossier = os.environ.get("WEB_3D_BIN")
    if dossier:
        return os.path.join(dossier, exe)
    if not _compile:
        subprocess.run(["cargo", "build", "--quiet", "--bins"], cwd=DEPOT, check=True, stdout=sys.stderr)
        _compile = True
    return os.path.join(DEPOT, "target", "debug", exe)
