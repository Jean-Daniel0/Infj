/**
 * ============================================================
 * integration-example.js — Comment déclencher le certificat
 * ============================================================
 *
 * Colle ce code dans la page où l'élève termine un cours.
 * Adapte les noms de tables à ton projet Supabase.
 *
 * ============================================================
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { generateCertificate } from './generate-certificate.js';

const SUPABASE_URL  = 'https://XXXXXXXXXXXX.supabase.co';
const SUPABASE_ANON = 'ta-clé-anon-ici';
const supabase      = createClient(SUPABASE_URL, SUPABASE_ANON);


// ─────────────────────────────────────────────────────────────
// 1. DÉCLENCHER QUAND L'ÉLÈVE FINIT LE DERNIER MODULE
// ─────────────────────────────────────────────────────────────
// Appelle cette fonction depuis ton bouton "Terminer le cours"
// ou depuis ta logique de validation de quiz/module.

async function onCourseCompleted(coursId) {

  // Récupère l'utilisateur connecté
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('Non connecté.');

  const eleveId = user.id;

  // Marque le cours comme complété dans ta table "completions"
  const { error } = await supabase
    .from('completions')
    .upsert({
      eleve_id:     eleveId,
      cours_id:     coursId,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'eleve_id,cours_id' });   // évite les doublons

  if (error) {
    console.error('Erreur complétion :', error);
    return;
  }

  // Génère le certificat automatiquement
  await triggerCertificate(eleveId, coursId);
}


// ─────────────────────────────────────────────────────────────
// 2. GÉNÉRATION AVEC FEEDBACK VISUEL
// ─────────────────────────────────────────────────────────────

async function triggerCertificate(eleveId, coursId) {
  const banner = document.getElementById('cert-status');  // ton élément de feedback

  try {
    showStatus(banner, 'loading', 'Génération de votre certificat...');

    const { pdfUrl, certId } = await generateCertificate(eleveId, coursId, {
      onProgress: msg => showStatus(banner, 'loading', msg),
    });

    showStatus(banner, 'success',
      `Certificat prêt ! <a href="${pdfUrl}" target="_blank">Télécharger</a>`
    );

    // Affiche aussi le lien dans le profil de l'élève
    displayCertLink(pdfUrl, certId);

  } catch (err) {
    showStatus(banner, 'error', 'Erreur lors de la génération. Réessaie.');
    console.error(err);
  }
}


// ─────────────────────────────────────────────────────────────
// 3. AFFICHER LES CERTIFICATS DE L'ÉLÈVE (page profil)
// ─────────────────────────────────────────────────────────────

async function loadMyCertificates() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: certs, error } = await supabase
    .from('certificats')
    .select(`
      cert_id,
      pdf_url,
      created_at,
      courses ( title )
    `)
    .eq('eleve_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !certs.length) {
    document.getElementById('cert-list').innerHTML = '<p>Aucun certificat pour l\'instant.</p>';
    return;
  }

  const html = certs.map(c => `
    <div class="cert-card">
      <div class="cert-card-title">${c.courses?.title ?? 'Cours'}</div>
      <div class="cert-card-date">${new Date(c.created_at).toLocaleDateString('fr-FR')}</div>
      <a href="${c.pdf_url}" target="_blank" class="cert-card-btn">
        Télécharger le certificat
      </a>
    </div>
  `).join('');

  document.getElementById('cert-list').innerHTML = html;
}


// ─────────────────────────────────────────────────────────────
// 4. HELPERS UI
// ─────────────────────────────────────────────────────────────

function showStatus(el, type, msg) {
  if (!el) return;
  const colors = { loading: '#170e7c', success: '#0f6e56', error: '#a32d2d' };
  el.style.color   = colors[type] ?? '#333';
  el.innerHTML     = msg;
  el.style.display = 'block';
}

function displayCertLink(pdfUrl, certId) {
  const container = document.getElementById('cert-download');
  if (!container) return;
  container.innerHTML = `
    <a href="${pdfUrl}" download="${certId}.pdf" style="
      display:inline-block; padding:12px 24px; background:#170e7c; color:#fff;
      border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;
    ">
      Télécharger mon certificat
    </a>
  `;
}


// ─────────────────────────────────────────────────────────────
// 5. EXEMPLE D'UTILISATION DANS TON HTML
// ─────────────────────────────────────────────────────────────

/*

Dans ta page HTML, ajoute :

  <!-- Status de génération -->
  <div id="cert-status" style="display:none; padding:12px; border-radius:8px; margin:16px 0;"></div>

  <!-- Lien de téléchargement -->
  <div id="cert-download"></div>

  <!-- Liste des certificats (page profil) -->
  <div id="cert-list"></div>

  <!-- Bouton de fin de cours -->
  <button onclick="onCourseCompleted('uuid-du-cours-ici')">
    Terminer le cours
  </button>

  <!-- Script html2pdf (CDN) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>

  <!-- Ton script -->
  <script type="module" src="./integration-example.js"></script>

*/


// ─────────────────────────────────────────────────────────────
// 6. STRUCTURE DE BASE DE DONNÉES SUPABASE REQUISE
// ─────────────────────────────────────────────────────────────

/*

-- Table des profils utilisateurs (souvent déjà créée avec Supabase Auth)
create table profiles (
  id          uuid references auth.users primary key,
  full_name   text not null,
  email       text
);

-- Table des cours
create table courses (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  duration_minutes  integer,
  created_at        timestamptz default now()
);

-- Table de suivi des complétion
create table completions (
  id           uuid primary key default gen_random_uuid(),
  eleve_id     uuid references profiles(id),
  cours_id     uuid references courses(id),
  completed_at timestamptz default now(),
  unique (eleve_id, cours_id)           -- un seul certificat par cours
);

-- Table des certificats générés
create table certificats (
  id          uuid primary key default gen_random_uuid(),
  eleve_id    uuid references profiles(id),
  cours_id    uuid references courses(id),
  cert_id     text unique not null,     -- ex: CERT-2026-12345
  pdf_url     text not null,
  created_at  timestamptz default now()
);

-- Buckets Supabase Storage à créer (Dashboard > Storage) :
--   "certificats"   → public, pour les PDFs générés
--   "signatures"    → public, pour les images de signatures

*/
