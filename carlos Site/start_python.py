#!/usr/bin/env python3
"""
Script de démarrage pour lancer le serveur frontend
"""

import subprocess
import sys
import signal

def signal_handler(sig, frame):
    print("\n\nArrêt du serveur...")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)


def main():
    print("=" * 50)
    print("Démarrage du serveur frontend")
    print("=" * 50)
    print()

    if sys.version_info < (3, 6):
        print("ERREUR: Python 3.6 ou supérieur est requis")
        sys.exit(1)

    try:
        subprocess.run([sys.executable, 'server_frontend.py'], check=True)
    except KeyboardInterrupt:
        print("\n\nArrêt du serveur...")
    except subprocess.CalledProcessError as error:
        print(f"Erreur lors du démarrage: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
