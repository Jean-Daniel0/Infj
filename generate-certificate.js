/**
 * ============================================================
 * generate-certificate.js — AcadémieWeb
 * ============================================================
 *
 * Ce fichier gère :
 *  1. La récupération des données depuis Supabase
 *  2. L'injection des données dans le template HTML
 *  3. La génération du PDF avec html2pdf.js
 *  4. La sauvegarde du PDF dans Supabase Storage
 *  5. L'enregistrement du lien dans la table "completions"
 *
 * INSTALLATION :
 *   npm install @supabase/supabase-js
 *   Ajouter dans ton HTML : <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
 *
 * ============================================================
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ─── CONFIG ─────────────────────────────────────────────────
// NOTE: ce fichier n'est actuellement importé nulle part dans l'app (courses.js a sa
// propre fonction downloadCertificate indépendante). Corrigé pour cohérence avec le
// vrai schéma Supabase (users/formations/inscriptions/completions/certificats),
// à réactiver seulement si besoin.
const SUPABASE_URL  = 'https://nnppbnqavajmublpfhkj.supabase.co';
const SUPABASE_ANON = 'sb_publishable_kYqjUg-ftxahv35qUaDdpA_CMkJdwL-';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── CONFIGURATION DES SIGNATURES ───────────────────────────
// Upload tes images de signature dans Supabase Storage > bucket "signatures"
// puis mets les noms de fichier ici. Remplace par les vrais signataires de l'INFJ.
const SIGNATURES = {
  sig1: {
    nom:  'Me Robertho Carlos Deronceray',
    role: 'Directeur de l\'Institut',
    file: 'signature-directeur.png',   // fichier dans le bucket "signatures"
  },
  sig2: {
    nom:  '',
    role: 'Formateur',
    file: 'signature-formateur.png',
  },
};

// ─── GENERATEUR D'ID UNIQUE ─────────────────────────────────
function generateCertId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `CERT-${year}-${rand}`;
}

// ─── FORMATAGE DE LA DATE ────────────────────────────────────
function formatDate(dateString) {
  const d = new Date(dateString || Date.now());
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ─── FORMATAGE DE LA DURÉE ──────────────────────────────────
function formatDuree(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h} heures`;
}

// ─── URL PUBLIQUE D'UN FICHIER SUPABASE STORAGE ─────────────
function getStorageUrl(bucket, filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
}

// ─── UPLOAD DU PDF DANS SUPABASE STORAGE ────────────────────
async function uploadPDF(blob, certId, eleveId) {
  const filename = `${eleveId}/${certId}.pdf`;

  const { data, error } = await supabase
    .storage
    .from('certificats-pdf')        // bucket de stockage (distinct de la table 'certificats')
    .upload(filename, blob, {
      contentType: 'application/pdf',
      upsert: true,                 // remplace si déjà existant
    });

  if (error) throw new Error(`Upload PDF échoué : ${error.message}`);

  // Retourne l'URL publique
  const { data: urlData } = supabase
    .storage
    .from('certificats-pdf')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

// ─── ENREGISTREMENT EN BASE ──────────────────────────────────
// Schéma réel: certificats(numero_certificat, inscription_id, formation_id, pdf_url, date_emission)
async function saveCertRecord(inscriptionId, formationId, certId, pdfUrl) {
  const { error } = await supabase
    .from('certificats')
    .insert({
      numero_certificat: certId,
      inscription_id:    inscriptionId,
      formation_id:       formationId,
      pdf_url:            pdfUrl,
      date_emission:      new Date().toISOString(),
    });

  if (error) throw new Error(`Sauvegarde BDD échouée : ${error.message}`);
}

// ─── CONSTRUCTION DU HTML DU CERTIFICAT ─────────────────────
async function buildCertificateHTML(data) {
  const { nom, cours, duree, dateCompletion, certId } = data;

  // URLs des signatures depuis Supabase Storage
  const sig1Url = getStorageUrl('signatures', SIGNATURES.sig1.file);
  const sig2Url = getStorageUrl('signatures', SIGNATURES.sig2.file);

  // Charge le template HTML depuis le même dossier
  const response = await fetch('./certificate-template.html');
  let html = await response.text();

  // Remplace toutes les variables {{...}}
  const replacements = {
    '{{NOM}}':       nom,
    '{{COURS}}':     cours,
    '{{DUREE}}':     formatDuree(duree),
    '{{DATE}}':      formatDate(dateCompletion),
    '{{CERT_ID}}':   certId,
    '{{SIG1_URL}}':  sig1Url,
    '{{SIG1_NOM}}':  SIGNATURES.sig1.nom,
    '{{SIG1_ROLE}}': SIGNATURES.sig1.role,
    '{{SIG2_URL}}':  sig2Url,
    '{{SIG2_NOM}}':  SIGNATURES.sig2.nom,
    '{{SIG2_ROLE}}': SIGNATURES.sig2.role,
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value ?? '—');
  }

  return html;
}

// ─── GÉNÉRATION DU PDF ───────────────────────────────────────
async function generatePDF(html, certId) {
  // Crée un iframe caché pour rendre le HTML
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:842px;height:595px;border:none;';
  document.body.appendChild(iframe);

  // Injecte le HTML dans l'iframe
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  // Attend que les polices et images chargent
  await new Promise(resolve => setTimeout(resolve, 1200));

  const element = iframe.contentDocument.getElementById('certificat');

  const options = {
    margin:      0,
    filename:    `${certId}.pdf`,
    image:       { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,                     // haute résolution
      useCORS: true,
      logging: false,
      width: 842,
      height: 595,
    },
    jsPDF: {
      unit: 'px',
      format: [842, 595],           // A4 paysage en pixels
      orientation: 'landscape',
    },
  };

  // Génère le blob PDF (sans téléchargement automatique)
  const blob = await html2pdf()
    .set(options)
    .from(element)
    .outputPdf('blob');

  document.body.removeChild(iframe);
  return blob;
}

// ─── FONCTION PRINCIPALE ─────────────────────────────────────
/**
 * Génère et sauvegarde le certificat d'un élève.
 *
 * @param {string} inscriptionId - ID de l'inscription (uuid) liant l'élève à sa formation
 * @param {object} options       - { onProgress } callback optionnel
 * @returns {string}             - URL publique du PDF généré
 *
 * Usage :
 *   const url = await generateCertificate('uuid-inscription');
 */
/**
 * @param {string} inscriptionId - ID de l'inscription (uuid) liant l'élève à la formation
 */
export async function generateCertificate(inscriptionId, options = {}) {
  const { onProgress } = options;
  const log = msg => { console.log(`[Certificat] ${msg}`); onProgress?.(msg); };

  try {
    // ── 1. Récupère l'inscription (élève + formation liés) ────
    log('Récupération des données...');

    const { data: inscription, error: errInsc } = await supabase
      .from('inscriptions')
      .select('id, user_id, formation_id, nom_complet, email')
      .eq('id', inscriptionId)
      .single();

    if (errInsc) throw new Error(`Inscription introuvable : ${errInsc.message}`);

    // ── 2. Récupère les infos de la formation ─────────────────
    const { data: formation, error: errFormation } = await supabase
      .from('formations')
      .select('titre, duree')
      .eq('id', inscription.formation_id)
      .single();

    if (errFormation) throw new Error(`Formation introuvable : ${errFormation.message}`);

    // ── 3. Récupère la date de complétion ─────────────────────
    const { data: completion } = await supabase
      .from('completions')
      .select('completed_at')
      .eq('inscription_id', inscription.id)
      .eq('formation_id', inscription.formation_id)
      .maybeSingle();

    // ── 4. Prépare les données ────────────────────────────────
    const certId = generateCertId();
    const certData = {
      nom:            inscription.nom_complet,
      cours:          formation.titre,
      duree:          formation.duree,
      dateCompletion: completion?.completed_at || new Date().toISOString(),
      certId,
    };

    // ── 5. Construit le HTML ──────────────────────────────────
    log('Construction du certificat...');
    const html = await buildCertificateHTML(certData);

    // ── 6. Génère le PDF ──────────────────────────────────────
    log('Génération du PDF...');
    const blob = await generatePDF(html, certId);

    // ── 7. Upload dans Supabase Storage ───────────────────────
    log('Sauvegarde dans le cloud...');
    const pdfUrl = await uploadPDF(blob, certId, inscription.user_id);

    // ── 8. Enregistre en base ─────────────────────────────────
    await saveCertRecord(inscription.id, inscription.formation_id, certId, pdfUrl);

    log('Certificat créé !');
    return { pdfUrl, certId };

  } catch (err) {
    console.error('[Certificat] Erreur :', err);
    throw err;
  }
}

// ─── TÉLÉCHARGEMENT DIRECT (optionnel) ───────────────────────
/**
 * Génère et télécharge immédiatement le certificat dans le navigateur.
 * Utile pour un bouton "Télécharger mon certificat".
 */
export async function downloadCertificate(inscriptionId) {
  const { pdfUrl, certId } = await generateCertificate(inscriptionId);
  const a = document.createElement('a');
  a.href = pdfUrl;
  a.download = `${certId}.pdf`;
  a.click();
  return { pdfUrl, certId };
}
