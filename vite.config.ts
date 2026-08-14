import {defineConfig} from 'vite';
import path from 'path';

export default defineConfig(() => {
  return {
    root: path.resolve(__dirname, 'carlos Site/frontend'),
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      assetsDir: 'assets',
      sourcemap: true,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'carlos Site/frontend/index.html'),
          adminVideos: path.resolve(__dirname, 'carlos Site/frontend/admin-videos.html'),
          contact: path.resolve(__dirname, 'carlos Site/frontend/contact.html'),
          cours: path.resolve(__dirname, 'carlos Site/frontend/cours.html'),
          formation: path.resolve(__dirname, 'carlos Site/frontend/formation.html'),
          live: path.resolve(__dirname, 'carlos Site/frontend/live.html'),
          login: path.resolve(__dirname, 'carlos Site/frontend/login.html'),
          register: path.resolve(__dirname, 'carlos Site/frontend/register.html'),
          inscription: path.resolve(__dirname, 'carlos Site/frontend/inscription.html'),
          video: path.resolve(__dirname, 'carlos Site/frontend/video.html'),
          certificatComplet: path.resolve(__dirname, 'carlos Site/frontend/certificat-complet.html'),
          paiementSucces: path.resolve(__dirname, 'carlos Site/frontend/paiement-succes.html'),
          paiementErreur: path.resolve(__dirname, 'carlos Site/frontend/paiement-erreur.html'),
          adminLiveIndex: path.resolve(__dirname, 'carlos Site/frontend/admin/live/index.html'),
          adminLiveCreer: path.resolve(__dirname, 'carlos Site/frontend/admin/live/creer.html'),
          adminLiveModifier: path.resolve(__dirname, 'carlos Site/frontend/admin/live/modifier.html')
        }
      }
    }
  };
});
