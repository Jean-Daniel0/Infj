#!/usr/bin/env python3
"""
Serveur HTTP simple pour servir les fichiers statiques du frontend
"""

import http.server
import socketserver
import os
import sys

PORT = 3000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Changer le répertoire de travail vers le dossier frontend
        os.chdir(os.path.join(os.path.dirname(__file__), 'frontend'))
        super().__init__(*args, **kwargs)
    
    def end_headers(self):
        # Ajouter les headers CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def run_server():
    """Démarrer le serveur frontend"""
    os.chdir(os.path.join(os.path.dirname(__file__), 'frontend'))
    
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"Serveur frontend démarré sur http://localhost:{PORT}")
        print(f"Ouvrez http://localhost:{PORT}/video.html dans votre navigateur")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nArrêt du serveur...")

if __name__ == "__main__":
    run_server()

