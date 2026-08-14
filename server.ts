import express from "express";
import path from "path";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";

dotenv.config();

// Fixes for deployment and sandbox networks if needed
dns.setDefaultResultOrder?.('ipv4first');

const app = express();
const PORT = 3000;

app.use(express.json({
  verify: (req: any, res: any, buf: Buffer) => {
    req.rawBody = buf;
  }
}));

// Logger for API requests to verify communication
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    console.log(`[API REQUEST] ${req.method} ${req.url} - Headers:`, {
      host: req.headers.host,
      auth: req.headers.authorization ? "Bearer [PRESENT]" : "[MISSING]"
    });
  }
  next();
});

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nnppbnqavajmublpfhkj.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kYqjUg-ftxahv35qUaDdpA_CMkJdwL-';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client admin (service_role) : nécessaire pour écrire dans les tables protégées par RLS
// (pending_payments, transactions, webhook_events) qui n'autorisent aucun accès anon/authenticated.
// Sans SUPABASE_SERVICE_ROLE_KEY, ces écritures échoueront silencieusement.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Config] SUPABASE_SERVICE_ROLE_KEY manquante — les écritures de paiement (pending_payments/transactions/webhook_events) échoueront.');
}
const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
);

// Vérifie le token JWT envoyé par le client et retourne l'utilisateur authentifié Supabase.
// Utilisé pour ne JAMAIS faire confiance à un userId envoyé tel quel dans le body d'une requête.
const verifyAuthUser = async (req: express.Request): Promise<{ user: any; error: string | null }> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { user: null, error: 'Token d\'authentification manquant' };
  const token = authHeader.split(' ')[1];
  if (!token) return { user: null, error: 'Token d\'authentification manquant' };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { user: null, error: 'Non authentifié' };
  return { user, error: null };
};

// JaaS Credentials
const JAAS_APP_ID = 'vpaas-magic-a0923f1ee969475aaaae4297b102f416';
const JAAS_KEY_ID = 'vpaas-magic-a0923f1ee969475aaaae4297b102f416/66a891';

// API route first: JaaS token generations
app.get('/api/jitsi/token', async (req: any, res: any) => {
  const { sessionId, role } = req.query;
  const estAdmin = role === 'moderator';

  console.log('=== TOKEN REQUEST ===');
  console.log('sessionId:', sessionId);
  console.log('role demandé:', role);
  console.log('estAdmin:', estAdmin);

  // Récupérer l'utilisateur connecté
  const authHeader = req.headers.authorization;
  console.log('Auth header:', authHeader ? 'présent' : 'absent');

  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Token d\'authentification manquant' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log('User Supabase:', user?.id || 'non trouvé');
    console.log('Auth error:', authError?.message || 'aucune');

    if (!user || authError) {
      return res.status(401).json({ 
        error: 'Non authentifié' 
      });
    }

    // Récupérer le profil depuis la table users
    let { data: profil, error: profilError } = await supabase
      .from('users')
      .select('nom, prenom, email, role')
      .eq('id', user.id)
      .maybeSingle();

    console.log('Profil trouvé:', profil);
    console.log('Role du profil:', profil?.role);
    console.log('Profil error:', profilError?.message || 'aucune');

    // AUTO-CREATION OU FALLBACK POUR L'ADMINISTRATEUR UNIQUE mradmin@infj.com
    const estMasterAdmin = user.email && user.email.toLowerCase() === 'mradmin@infj.com';

    if (!profil && estMasterAdmin) {
      console.log("Master Admin mradmin@infj.com n'a pas de profil public, création automatique.");
      try {
        const nouveauProfil = {
          id: user.id,
          email: user.email,
          nom: 'Admin',
          prenom: 'Mr',
          role: 'admin'
        };
        const { data: insertedData, error: insertError } = await supabase
          .from('users')
          .insert([nouveauProfil])
          .select()
          .maybeSingle();
        
        if (insertError) {
          console.error("Erreur lors de l'insertion automatique du profil admin:", insertError.message);
        } else {
          console.log("Profil admin créé avec succès en base de données !");
          profil = insertedData || nouveauProfil;
        }
      } catch (e: any) {
        console.error("Crash insertion admin:", e.message);
      }
      
      // Fallback local en cas d'erreur de base de données
      if (!profil) {
        profil = {
          nom: 'Admin',
          prenom: 'Mr',
          email: user.email,
          role: 'admin'
        };
      }
    }

    if (!profil) {
      console.log(`Profil introuvable pour ${user.email || user.id}. Utilisation d'un profil virtuel.`);
      profil = {
        nom: user.email?.split('@')[0] || 'Utilisateur',
        prenom: '',
        email: user.email || '',
        role: 'user'
      };
    }

    // Vérification admin & Auto-promotion de l'e-mail administrateur autorisé
    const adminEmails = ['mradmin@infj.com'];
    let estVraimantAdmin = profil.role === 'admin' || (user.email && adminEmails.includes(user.email.toLowerCase()));
    
    if (user.email && adminEmails.includes(user.email.toLowerCase())) {
      estVraimantAdmin = true;
      if (profil.role !== 'admin') {
        console.log(`Auto-promouvant l'utilisateur ${user.email} au rôle admin...`);
        try {
          await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', user.id);
          profil.role = 'admin';
        } catch (dbError: any) {
          console.error('Erreur lors de la promotion admin en base de données:', dbError.message);
        }
      }
    }

    console.log('Est vraiment admin:', estVraimantAdmin);

    // Si role=moderator demandé mais pas admin → refuser
    if (estAdmin && !estVraimantAdmin) {
      return res.status(403).json({ 
        error: 'Accès modérateur refusé — pas admin' 
      });
    }

    // Vérifier que la session existe (avec fallback robuste)
    let meetingId = 'INFJ-Classe-Virtuelle-Interactive-Session';
    let session: any = null;
    
    try {
      const { data, error: sessionError } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      if (data) {
        session = data;
        meetingId = session.meeting_id || `INFJ-Live-${sessionId}`;
      }
    } catch (e) {
      console.warn('Erreur lors de la lecture de la session live_sessions:', e);
    }

    if (session) {
      console.log('Session trouvée:', session.titre);
    } else {
      console.log(`Session ${sessionId} introuvable en base ou erreur. Utilisation d'une session virtuelle.`);
      meetingId = `INFJ-Live-${sessionId || 'default'}`;
    }

    // Si élève — vérifier inscription (seulement pour les séances non gratuites)
    if (!estAdmin && !estVraimantAdmin && session && session.formation_id && session.gratuit === false) {
      const { data: inscription } = await supabase
        .from('inscriptions')
        .select('id, status')
        .eq('formation_id', session.formation_id)
        .eq('user_id', user.id)
        .eq('status', 'acceptee')
        .maybeSingle();

      console.log('Inscription:', inscription?.status || 'non trouvée');

      if (!inscription) {
        return res.status(403).json({ 
          error: 'Non inscrit à cette formation' 
        });
      }
    }

    // Générer le JWT JaaS
    const maintenant = Math.floor(Date.now() / 1000);
    const JAAS_APP_ID = 'vpaas-magic-a0923f1ee969475aaaae4297b102f416';
    const JAAS_KEY_ID = 'vpaas-magic-a0923f1ee969475aaaae4297b102f416/66a891';
    
    const payload = {
      aud: 'jitsi',
      iss: 'chat',
      iat: maintenant,
      exp: maintenant + (2 * 60 * 60),
      nbf: maintenant - 5,
      sub: JAAS_APP_ID,
      context: {
        features: {
          livestreaming:   estVraimantAdmin,
          recording:       estVraimantAdmin,
          transcription:   true,
          'outbound-call': false,
          'file-sharing':  estVraimantAdmin
        },
        user: {
          id:       user.id,
          name:     `${profil.prenom || ''} ${profil.nom || ''}`.trim() || user.email?.split('@')[0] || 'Utilisateur',
          email:    profil.email || user.email,
          moderator: estVraimantAdmin,
          'hidden-from-recorder': false
        }
      },
      room: meetingId
    };

    console.log('Payload JWT:', JSON.stringify(payload, null, 2));

    const privateKeyRaw = process.env.JAAS_PRIVATE_KEY;
    if (!privateKeyRaw) {
      console.warn('JAAS_PRIVATE_KEY manquante ! Repli vers meet.jit.si public/gratuit.');
      return res.json({ 
        token: 'fallback', 
        room: meetingId 
      });
    }

    try {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

      const jwtToken = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        header: {
          kid: JAAS_KEY_ID,
          typ: 'JWT'
        }
      });

      console.log('JWT généré avec succès');
      console.log('===================');

      return res.json({ 
        token: jwtToken, 
        room: meetingId 
      });
    } catch (signError: any) {
      console.error('Erreur signature JaaS JWT, repli vers meet.jit.si:', signError.message);
      return res.json({ 
        token: 'fallback', 
        room: meetingId 
      });
    }

  } catch (jwtError: any) {
    console.error('Erreur générale route JWT, repli vers meet.jit.si:', jwtError.message);
    return res.json({ 
      token: 'fallback', 
      room: meetingId 
    });
  }
});

// =====================================================================
// BAZIK MONCASH PAYMENT PASSERELLE INTEGRATION (BACKEND SERVER ENGINE)
// =====================================================================

interface PendingPayment {
  reference_id: string;
  type: 'formation' | 'live' | 'video';
  item_id: string;
  user_id: string;
  montant: number;
  expires_at: string;
}

interface Transaction {
  reference_id: string;
  type: string;
  item_id: string;
  user_id: string;
  montant_brut: number;
  commission: number;
  montant_client: number;
  bazik_order_id: string;
  statut: string;
  created_at: string;
}

// Stockage persistant via Supabase (table pending_payments) au lieu de fichiers JSON locaux.
// Un fichier local est perdu à chaque redéploiement/redémarrage sur Render — critique pour des paiements en cours.
const addPendingPayment = async (payment: PendingPayment) => {
  const { error } = await supabaseAdmin.from('pending_payments').insert({
    reference_id: payment.reference_id,
    type: payment.type,
    item_id: payment.item_id,
    user_id: payment.user_id,
    montant: payment.montant,
    expires_at: payment.expires_at
  });
  if (error) console.error('[Supabase] Erreur insertion pending_payments:', error.message);
};

const findPendingPayment = async (referenceId: string): Promise<PendingPayment | null> => {
  const { data, error } = await supabaseAdmin
    .from('pending_payments')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle();
  if (error) console.error('[Supabase] Erreur lecture pending_payments:', error.message);
  return data as PendingPayment | null;
};

const removePendingPayment = async (referenceId: string) => {
  const { error } = await supabaseAdmin.from('pending_payments').delete().eq('reference_id', referenceId);
  if (error) console.error('[Supabase] Erreur suppression pending_payments:', error.message);
};

const addTransaction = async (tx: Transaction) => {
  const { error } = await supabaseAdmin.from('transactions').insert({
    reference_id: tx.reference_id,
    type: tx.type,
    item_id: tx.item_id,
    user_id: tx.user_id,
    montant_brut: tx.montant_brut,
    commission: tx.commission,
    montant_client: tx.montant_client,
    bazik_order_id: tx.bazik_order_id,
    statut: tx.statut
  });
  if (error) console.error('[Supabase] Erreur insertion transactions:', error.message);
};

const findTransaction = async (referenceId: string): Promise<Transaction | null> => {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle();
  if (error) console.error('[Supabase] Erreur lecture transactions:', error.message);
  return data as Transaction | null;
};

// Retourne true si l'event a déjà été traité (idempotence webhook), en profitant de la
// contrainte UNIQUE sur event_id : un insert en doublon échoue proprement au lieu de dupliquer le traitement.
const recordWebhookEventIfNew = async (eventId: string, type: string, payload: any): Promise<boolean> => {
  const { error } = await supabaseAdmin.from('webhook_events').insert({
    event_id: eventId,
    type,
    payload
  });
  if (error) {
    // code 23505 = violation de contrainte unique -> déjà traité
    if ((error as any).code === '23505') return false;
    console.error('[Supabase] Erreur insertion webhook_events:', error.message);
  }
  return true;
};

// Base URL de la passerelle Bazik (toujours https://api.bazik.io peu importe le mode d'après les spécifications de l'API)
const BAZIK_BASE_URL = 'https://api.bazik.io';

// Ajuste l'URL de redirection MonCash de manière résiliente. 
// Si des identifiants sandbox sont utilisés (ou en mode dev), on s'assure de rediriger vers 'sandbox.moncashbutton.digicelgroup.com'.
const adjustRedirectUrl = (url: string): string => {
  if (!url) return url;
  
  const secretKey = process.env.BAZIK_SECRET_KEY || '';
  
  // Auto-détection robuste du mode de clé existant :
  // Si la clé commence par 'live_' ou contient 'prod', on est en production, sinon on force ou reste en sandbox par défaut.
  const isProduction = 
    secretKey.startsWith('live_') || 
    secretKey.toLowerCase().includes('prod') ||
    process.env.BAZIK_PRODUCTION === 'true';

  const isSandbox = !isProduction || 
                    process.env.BAZIK_SANDBOX === 'true' || 
                    process.env.MONCASH_SANDBOX === 'true' || 
                    url.includes('sandbox');
                    
  if (isSandbox && url.includes('moncashbutton.digicelgroup.com') && !url.includes('sandbox.moncashbutton.digicelgroup.com')) {
    console.log('[Bazik Payment] Redirection MonCash réécrite vers le sandbox :', url);
    return url.replace('moncashbutton.digicelgroup.com', 'sandbox.moncashbutton.digicelgroup.com');
  }
  return url;
};

let bazikTokenCache: string | null = null;
let bazikTokenExpiry: number | null = null;

const getBazikToken = async () => {
  if (bazikTokenCache && bazikTokenExpiry && bazikTokenExpiry > Date.now()) {
    return bazikTokenCache;
  }

  const userId = process.env.BAZIK_USER_ID;
  const secretKey = process.env.BAZIK_SECRET_KEY;

  if (!userId || !secretKey) {
    throw new Error("Variables d'environnement BAZIK_USER_ID ou BAZIK_SECRET_KEY manquantes.");
  }

  console.log('[Bazik Token API] Authentification de la passerelle en cours...');
  const response = await fetch(`${BAZIK_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userID: userId,
      secretKey: secretKey
    })
  });

  const data: any = await response.json();
  
  if (!response.ok || !data.success || !data.token) {
    console.error('[Bazik Token API] Échec authentification:', data);
    throw new Error('Authentification Bazik échouée');
  }

  bazikTokenCache = data.token;
  
  // Cache the token, expires 1 hour before actual expiration
  let expiresAt = Date.now() + 23 * 60 * 60 * 1000; // fallback default 23 hours
  if (data.expires_at) {
    const parsedExp = isNaN(data.expires_at) ? Date.parse(data.expires_at) : Number(data.expires_at);
    if (!isNaN(parsedExp)) {
      expiresAt = parsedExp - (60 * 60 * 1000);
    }
  }
  bazikTokenExpiry = expiresAt;
  
  return data.token;
};

// Auto renew interval (every 23 hours)
setInterval(async () => {
  try {
    bazikTokenCache = null;
    bazikTokenExpiry = null;
    await getBazikToken();
    console.log('[Bazik Token Automation] Renouvellement automatique du jeton de sécurité réussi.');
  } catch (err: any) {
    console.error('[Bazik Token Automation] Échec du renouvellement:', err.message);
  }
}, 23 * 60 * 60 * 1000);

// Helper function to send notification email upon payment confirmation
const envoyerEmailConfirmationPaiement = async (user: any, courseTitle: string, itemType: string) => {
  const resend = getResendClient();
  if (!resend || !user.email) {
    console.log('[Email Service] Option e-mail non raccordée (envoi simulé pour le paiement)');
    return;
  }

  try {
    const emailHTML = `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="https://nnppbnqavajmublpfhkj.supabase.co/storage/v1/object/public/videos/logo.png" alt="Logo INFJ" style="height: 60px;" />
          <h2 style="color: #003366; margin-top: 12px; font-size: 22px; font-weight: 700;">💳 Paiement validé avec succès !</h2>
        </div>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">Bonjour <strong>${user.prenom || ''} ${user.nom || ''}</strong>,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">Nous vous confirmons la réception et validation de votre paiement en ligne par MonCash pour l'élément suivant :</p>
        
        <p style="font-size: 16px; font-weight: 700; color: #003366; text-align: center; padding: 14px; background-color: #f1f5f9; border-radius: 8px; margin: 16px 0;">
          « ${courseTitle} » (${itemType})
        </p>
        
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">Félicitations, vos accès sont désormais instantanément actifs ! Vous pouvez vous rendre directement sur votre espace étudiant pour en profiter.</p>
        
        <div style="text-align: center; margin: 28px 0;">
          <a href="${process.env.BASE_URL || 'https://infj-academie.com'}/cours.html" target="_blank" style="background-color: #f47c20; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 15px; text-transform: uppercase;">
            Accéder à mon espace cours
          </a>
        </div>
        
        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-top: 24px;">
          L'équipe de l'Institut National de Formation des Jeunes vous félicite et vous souhaite de très belles sessions d'apprentissage.
        </p>

        <p style="font-size: 14px; font-weight: 600; color: #003366; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          Cordialement,<br/>
          Me Robertho Carlos Deronceray<br/>
          <span style="font-size: 12px; color: #64748b; font-weight: normal;">Directeur de l'Institut National de Formation des Jeunes</span>
        </p>
      </div>
    `;

    await resend.emails.send({
      from: 'INFJ Academie <onboarding@resend.dev>',
      to: [user.email],
      subject: `✅ Paiement validé pour "${courseTitle}" - INFJ`,
      html: emailHTML,
    });
    console.log('[Email Service] Envoyé pour', user.email);
  } catch (err: any) {
    console.error('[Email Service] Échec envoi:', err.message);
  }
};

// Helper activation inscription
// Utilise supabaseAdmin (service_role) : cette écriture se fait après confirmation webhook,
// hors contexte utilisateur authentifié, donc les policies RLS (auth.uid() = user_id) la bloqueraient sinon.
const activerInscription = async (formationId: string, userId: string, method: string, reference: string, amount: number) => {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!user) {
      console.error('[Activateur Inscription] Utilisateur introuvable:', userId);
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('inscriptions')
      .select('id, status')
      .eq('formation_id', formationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.status === 'acceptee') {
      console.log('[Activateur Inscription] Déjà inscrit:', userId);
      return;
    }

    if (existing) {
      await supabaseAdmin
        .from('inscriptions')
        .update({
          status: 'acceptee',
          methode_paiement: method,
          reference_paiement: reference,
          montant_paye: amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('inscriptions')
        .insert({
          user_id: userId,
          formation_id: formationId,
          nom: user.nom || '',
          prenom: user.prenom || '',
          email: user.email || '',
          telephone: user.telephone || '',
          status: 'acceptee',
          methode_paiement: method,
          reference_paiement: reference,
          montant_paye: amount,
          created_at: new Date().toISOString()
        });
    }

    // Decrement remaining slots
    try {
      const { data: formation } = await supabaseAdmin
        .from('formations')
        .select('places_restantes')
        .eq('id', formationId)
        .maybeSingle();

      if (formation && formation.places_restantes !== null) {
        const remaining = Math.max(0, formation.places_restantes - 1);
        await supabaseAdmin
          .from('formations')
          .update({ places_restantes: remaining })
          .eq('id', formationId);
      }
    } catch { /* silently ignore if not present */ }

    // Notify student
    const { data: formationObj } = await supabaseAdmin
      .from('formations')
      .select('titre')
      .eq('id', formationId)
      .maybeSingle();

    if (formationObj) {
      await envoyerEmailConfirmationPaiement(user, formationObj.titre, 'Formation');
    }
  } catch (err: any) {
    console.error('[Activateur Inscription] Erreur:', err.message);
  }
};

// Helper activation video
// supabaseAdmin (service_role) pour la même raison que activerInscription.
const activerAchatVideo = async (coursVideoId: string, userId: string, method: string, reference: string, amount: number) => {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!user) return;

    const { data: existing } = await supabaseAdmin
      .from('inscriptions')
      .select('id, status')
      .eq('cours_video_id', coursVideoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.status === 'acceptee') {
      return;
    }

    if (existing) {
      await supabaseAdmin
        .from('inscriptions')
        .update({
          status: 'acceptee',
          methode_paiement: method,
          reference_paiement: reference,
          montant_paye: amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('inscriptions')
        .insert({
          user_id: userId,
          cours_video_id: coursVideoId,
          nom: user.nom || '',
          prenom: user.prenom || '',
          email: user.email || '',
          telephone: user.telephone || '',
          status: 'acceptee',
          methode_paiement: method,
          reference_paiement: reference,
          montant_paye: amount,
          created_at: new Date().toISOString()
        });
    }

    await envoyerEmailConfirmationPaiement(user, `Mallette de Cours — ${coursVideoId}`, 'Cours Vidéo');
  } catch (err: any) {
    console.error('[Activateur Vidéo] Erreur:', err.message);
  }
};

// Helper activation live
const donnerAccesLive = async (sessionId: string, userId: string) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!user) return;

    const { data: existing } = await supabase
      .from('live_attendance')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('live_attendance')
        .update({ a_acces: true })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('live_attendance')
        .insert({
          session_id: sessionId,
          user_id: userId,
          email: user.email || '',
          nom_complet: `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Élève',
          a_acces: true,
          joined_at: new Date().toISOString()
        });
    }

    const { data: session } = await supabase
      .from('live_sessions')
      .select('titre')
      .eq('id', sessionId)
      .maybeSingle();

    if (session) {
      await envoyerEmailConfirmationPaiement(user, session.titre, 'Classe Live');
    }
  } catch (err: any) {
    console.error('[Activateur Live] Erreur:', err.message);
  }
};

// Webhook handles
const traiterPaiementReussi = async (event: any) => {
  const referenceId = event.referenceId || event.reference_id || (event.payload && event.payload.referenceId);
  if (!referenceId) {
    console.error('[Webhook] Reussi sans referenceId:', event);
    return;
  }

  const pending = await findPendingPayment(referenceId);

  if (!pending) {
    console.error('[Webhook] Pending introuvable pour:', referenceId);
    return;
  }

  const commission = pending.montant * 0.065; // 6.5% standard commission
  const montantClient = pending.montant - commission;

  await addTransaction({
    reference_id: referenceId,
    type: pending.type,
    item_id: pending.item_id,
    user_id: pending.user_id,
    montant_brut: pending.montant,
    commission,
    montant_client: montantClient,
    bazik_order_id: event.orderId || event.order_id || '',
    statut: 'completed',
    created_at: new Date().toISOString()
  });

  console.log(`[Webhook] Traitement activation : ${pending.type} (${referenceId})`);

  if (pending.type === 'formation') {
    await activerInscription(pending.item_id, pending.user_id, 'MonCash (En Ligne - Bazik)', referenceId, pending.montant);
  } else if (pending.type === 'live') {
    await donnerAccesLive(pending.item_id, pending.user_id);
  } else if (pending.type === 'video') {
    await activerAchatVideo(pending.item_id, pending.user_id, 'MonCash (En Ligne - Bazik)', referenceId, pending.montant);
  }

  await removePendingPayment(referenceId);
};

const traiterPaiementEchoue = async (event: any) => {
  const referenceId = event.referenceId || event.reference_id || (event.payload && event.payload.referenceId);
  if (!referenceId) return;
  await removePendingPayment(referenceId);
};

// Endpoints definitions
app.get('/api/bazik/token', async (req: express.Request, res: express.Response) => {
  try {
    const token = await getBazikToken();
    res.json({ success: true, token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bazik/pay-formation', async (req: express.Request, res: express.Response) => {
  const { user: authUser, error: authError } = await verifyAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: authError || 'Non authentifié' });
  }
  const userId = authUser.id; // Jamais le userId envoyé par le client — toujours celui du token vérifié.

  const { formationId } = req.body;
  if (!formationId) {
    return res.status(400).json({ error: 'formationId is required.' });
  }

  try {
    const { data: formation } = await supabase
      .from('formations')
      .select('*')
      .eq('id', formationId)
      .maybeSingle();

    if (!formation) {
      return res.status(404).json({ error: 'Formation introuvable' });
    }

    if (formation.gratuit) {
      return res.status(400).json({ error: 'Cette formation est gratuite' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const referenceId = `FORM-${formationId.substring(0, 8)}-${Date.now()}`;

    await addPendingPayment({
      reference_id: referenceId,
      type: 'formation',
      item_id: formationId,
      user_id: userId,
      montant: Number(formation.prix),
      expires_at: new Date(Date.now() + 30 * 60000).toISOString()
    });

    const token = await getBazikToken();
    const cleanBaseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, "");

    console.log('[Bazik API] Création paiement formation chez Bazik, ref =', referenceId);
    const bazikRes = await fetch(`${BAZIK_BASE_URL}/moncash/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        gdes: Math.round(formation.prix),
        userID: process.env.BAZIK_USER_ID,
        successUrl: `${cleanBaseUrl}/paiement-succes.html?ref=${referenceId}`,
        errorUrl: `${cleanBaseUrl}/paiement-erreur.html?ref=${referenceId}`,
        description: `Inscription — ${formation.titre}`,
        referenceId: referenceId,
        customerFirstName: user?.prenom || '',
        customerLastName: user?.nom || '',
        customerEmail: user?.email || '',
        metadata: {
          webhookUrl: `${cleanBaseUrl}/api/bazik/webhook`,
          type: 'formation',
          formationId: formationId,
          userId: userId
        }
      })
    });

    if (!bazikRes.ok) {
      const errText = await bazikRes.text();
      throw new Error(`Erreur Bazik API (HTTP ${bazikRes.status}): ${errText}`);
    }

    const data: any = await bazikRes.json();
    if (!data.redirectUrl) {
      return res.status(500).json({ error: 'Erreur création paiement Bazik (redirectUrl absent)' });
    }

    const finalRedirectUrl = adjustRedirectUrl(data.redirectUrl);

    res.json({
      redirectUrl: finalRedirectUrl,
      orderId: data.orderId,
      referenceId: referenceId
    });

  } catch (err: any) {
    console.error('Erreur /api/bazik/pay-formation:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bazik/pay-live', async (req: express.Request, res: express.Response) => {
  const { user: authUser, error: authError } = await verifyAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: authError || 'Non authentifié' });
  }
  const userId = authUser.id;

  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  try {
    const { data: session } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session || session.gratuit) {
      return res.status(400).json({ error: 'Live gratuit ou introuvable' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const referenceId = `LIVE-${sessionId.substring(0, 8)}-${Date.now()}`;

    await addPendingPayment({
      reference_id: referenceId,
      type: 'live',
      item_id: sessionId,
      user_id: userId,
      montant: Number(session.prix),
      expires_at: new Date(Date.now() + 30 * 60000).toISOString()
    });

    const token = await getBazikToken();
    const cleanBaseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, "");

    console.log('[Bazik API] Création paiement live chez Bazik, ref =', referenceId);
    const bazikRes = await fetch(`${BAZIK_BASE_URL}/moncash/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        gdes: Math.round(session.prix),
        userID: process.env.BAZIK_USER_ID,
        successUrl: `${cleanBaseUrl}/paiement-succes.html?ref=${referenceId}`,
        errorUrl: `${cleanBaseUrl}/paiement-erreur.html?ref=${referenceId}`,
        description: `Accès live — ${session.titre}`,
        referenceId: referenceId,
        customerFirstName: user?.prenom || '',
        customerLastName: user?.nom || '',
        customerEmail: user?.email || '',
        metadata: {
          webhookUrl: `${cleanBaseUrl}/api/bazik/webhook`,
          type: 'live',
          sessionId: sessionId,
          userId: userId
        }
      })
    });

    if (!bazikRes.ok) {
      const errText = await bazikRes.text();
      throw new Error(`Erreur Bazik API (HTTP ${bazikRes.status}): ${errText}`);
    }

    const data: any = await bazikRes.json();
    if (!data.redirectUrl) {
      throw new Error('Erreur création paiement (redirectUrl nul)');
    }

    const finalRedirectUrl = adjustRedirectUrl(data.redirectUrl);

    res.json({
      redirectUrl: finalRedirectUrl,
      referenceId: referenceId
    });

  } catch (err: any) {
    console.error('Erreur /api/bazik/pay-live:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bazik/pay-video', async (req: express.Request, res: express.Response) => {
  const { user: authUser, error: authError } = await verifyAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: authError || 'Non authentifié' });
  }
  const userId = authUser.id;

  const { coursVideoId, price } = req.body;
  if (!coursVideoId) {
    return res.status(400).json({ error: 'coursVideoId is required.' });
  }

  try {
    let formationTitle = coursVideoId;
    let finalPrice = price ? Number(price) : 5000;

    const { data: formationsList } = await supabase
      .from('formations')
      .select('*');

    const matchingForm = (formationsList || []).find((f: any) => {
      const slug = f.titre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-');
      return f.id === coursVideoId || slug.includes(coursVideoId) || coursVideoId.includes(f.id.substring(0,8));
    });

    if (matchingForm) {
      formationTitle = matchingForm.titre;
      finalPrice = Number(matchingForm.prix);
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const referenceId = `VID-${coursVideoId.substring(0, 8)}-${Date.now()}`;

    await addPendingPayment({
      reference_id: referenceId,
      type: 'video',
      item_id: coursVideoId,
      user_id: userId,
      montant: finalPrice,
      expires_at: new Date(Date.now() + 30 * 60000).toISOString()
    });

    const token = await getBazikToken();
    const cleanBaseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, "");

    console.log('[Bazik API] Création paiement vidéo chez Bazik, ref =', referenceId);
    const bazikRes = await fetch(`${BAZIK_BASE_URL}/moncash/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        gdes: Math.round(finalPrice),
        userID: process.env.BAZIK_USER_ID,
        successUrl: `${cleanBaseUrl}/paiement-succes.html?ref=${referenceId}`,
        errorUrl: `${cleanBaseUrl}/paiement-erreur.html?ref=${referenceId}`,
        description: `Mallette de Cours — ${formationTitle}`,
        referenceId: referenceId,
        customerFirstName: user?.prenom || '',
        customerLastName: user?.nom || '',
        customerEmail: user?.email || '',
        metadata: {
          webhookUrl: `${cleanBaseUrl}/api/bazik/webhook`,
          type: 'video',
          coursVideoId: coursVideoId,
          userId: userId
        }
      })
    });

    if (!bazikRes.ok) {
      const errText = await bazikRes.text();
      throw new Error(`Erreur Bazik API (HTTP ${bazikRes.status}): ${errText}`);
    }

    const data: any = await bazikRes.json();
    if (!data.redirectUrl) {
      throw new Error('Erreur création paiement (redirectUrl nul)');
    }

    const finalRedirectUrl = adjustRedirectUrl(data.redirectUrl);

    res.json({
      redirectUrl: finalRedirectUrl,
      referenceId: referenceId
    });

  } catch (err: any) {
    console.error('Erreur /api/bazik/pay-video:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bazik/webhook', async (req: express.Request, res: express.Response) => {
  try {
    const signature = req.headers['x-bazik-signature'] as string;
    const timestamp = req.headers['x-bazik-timestamp'] as string;
    const eventId = req.headers['x-bazik-event-id'] as string;
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    const signedPayload = `${timestamp}.${eventId}.${rawBody}`;
    
    const expectedSig = 'v1=' + crypto
      .createHmac('sha256', process.env.BAZIK_WEBHOOK_SECRET || '')
      .update(signedPayload)
      .digest('hex');

    if (expectedSig !== signature) {
      console.warn('[Bazik Webhook] Échec de la signature HMAC (Simulée pour tests en sandbox si pas configurée)');
      // In production, we yield, in sandbox we let it continue if signature is omitted/fails
      if (process.env.NODE_ENV === "production" && process.env.BAZIK_WEBHOOK_SECRET) {
        return res.status(401).send('Signature invalide');
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log('[Bazik Webhook] Reçu event type:', event.type);

    const isNewEvent = await recordWebhookEventIfNew(eventId, event.type, event);
    if (!isNewEvent) {
      return res.status(200).send('Already processed');
    }

    if (event.type === 'payment.succeeded') {
      await traiterPaiementReussi(event);
    } else if (event.type === 'payment.failed' || event.type === 'payment.cancelled') {
      await traiterPaiementEchoue(event);
    }

    res.status(200).send('OK');

  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).send('Erreur serveur');
  }
});

app.get('/api/bazik/status/:referenceId', async (req: express.Request, res: express.Response) => {
  const { referenceId } = req.params;

  try {
    const t = await findTransaction(referenceId);
    if (t) {
      return res.json({ status: 'completed', transaction: t });
    }

    const { data: inscription } = await supabase
      .from('inscriptions')
      .select('*')
      .eq('reference_paiement', referenceId)
      .maybeSingle();

    if (inscription && inscription.status === 'acceptee') {
      return res.json({
        status: 'completed',
        transaction: {
          reference_id: referenceId,
          type: inscription.formation_id ? 'formation' : 'video',
          item_id: inscription.formation_id || inscription.cours_video_id,
          user_id: inscription.user_id,
          montant_brut: inscription.montant_paye,
          statut: 'completed'
        }
      });
    }

    const pending = await findPendingPayment(referenceId);
    if (pending) {
      return res.json({ status: 'pending' });
    }

    res.json({ status: 'not_found' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { Resend } from "resend";

// Lazily load Resend to prevent startup errors
let resendInstance: Resend | null = null;
function getResendClient() {
  if (!resendInstance) {
    let key = process.env.RESEND_API_KEY;
    if (key) {
      key = key.trim().replace(/^['"]|['"]$/g, '');
      if (key) {
        resendInstance = new Resend(key);
      }
    }
  }
  return resendInstance;
}

app.post('/api/send-certificate-email', async (req: any, res: any) => {
  const { studentName, courseTitle, pdfUrl, email } = req.body;

  if (!email || !studentName || !courseTitle || !pdfUrl) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }

  console.log(`[Email Service] Préparation de l'envoi pour ${studentName} (${email}) | URL: ${pdfUrl}`);

  try {
    const resend = getResendClient();
    
    if (resend) {
      const emailHTML = `
        <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://nnppbnqavajmublpfhkj.supabase.co/storage/v1/object/public/videos/logo.png" alt="Logo INFJ" style="height: 60px;" />
            <h2 style="color: #003366; margin-top: 12px; font-size: 22px; font-weight: 700;">Félicitations pour votre réussite !</h2>
          </div>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">Bonjour <strong>${studentName}</strong>,</p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">C'est avec un immense plaisir que nous vous contactons pour vous annoncer que vous avez brillamment complété et réussi la formation :</p>
          <p style="font-size: 16px; font-weight: 700; color: #003366; text-align: center; padding: 14px; background-color: #f1f5f9; border-radius: 8px; margin: 16px 0;">
            « ${courseTitle} »
          </p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">Votre <strong>Certificat d'Aptitude Professionnelle officiel</strong> a été généré et est immédiatement disponible sous format numérique haut de gamme.</p>
          
          <div style="text-align: center; margin: 28px 0;">
            <a href="${pdfUrl}" target="_blank" style="background-color: #f47c20; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 15px; text-transform: uppercase;">
              Télécharger mon Certificat (PDF)
            </a>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #cbd5e1; padding-top: 18px; margin-top: 24px;">
            Si le bouton ci-dessus ne fonctionne pas, vous pouvez copier-coller le lien suivant dans votre navigateur :<br/>
            <a href="${pdfUrl}" target="_blank" style="color: #f47c20; word-break: break-all;">${pdfUrl}</a>
          </p>
          
          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-top: 24px;">
            L'équipe de l'Institut National de Formation des Jeunes vous félicite chaleureusement pour votre implication et vous souhaite beaucoup de succès dans vos futurs projets professionnels.
          </p>

          <p style="font-size: 14px; font-weight: 600; color: #003366; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            Cordialement,<br/>
            Me Robertho Carlos Deronceray<br/>
            <span style="font-size: 12px; color: #64748b; font-weight: normal;">Directeur de l'Institut National de Formation des Jeunes</span>
          </p>
        </div>
      `;

      const response = await resend.emails.send({
        from: 'INFJ Academie <onboarding@resend.dev>',
        to: [email],
        subject: `🎓 Félicitations ! Votre certificat pour la formation "${courseTitle}"`,
        html: emailHTML,
      });

      console.log("[Email Service] Réponse du SDK Resend :", response);

      if (response && response.error) {
        console.error("[Email Service] Resend a retourné une erreur :", response.error);
        return res.status(400).json({ 
          success: false, 
          error: response.error.message || "Erreur de transmission Resend", 
          details: response.error 
        });
      }

      return res.json({ success: true, service: "Resend", details: response });
    } else {
      console.log("[Email Service] Simulé (Pas de clé d'API RESEND_API_KEY dans l'environnement)");
      return res.json({ 
        success: true, 
        service: "Simulated", 
        message: "Clé d'API ou service Resend absent, envoi simulé avec succès." 
      });
    }
  } catch (err: any) {
    console.error("[Email Service] Erreur lors de l'envoi de l'e-mail :", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  // Serve static images directly through Express to prevent any path/space URL decoding issues in Vite
  const isProd = process.env.NODE_ENV === "production";
  
  const imagesPath = isProd
    ? path.join(process.cwd(), 'dist/images')
    : path.resolve(process.cwd(), 'carlos Site/frontend/public/images');

  const fallbackImagesPath = isProd
    ? path.join(process.cwd(), 'dist/images')
    : path.resolve(process.cwd(), 'carlos Site/frontend/images');

  // Register image routes before Vite middleware to ensure they take precedence and serve reliably
  app.use('/images', express.static(imagesPath));
  app.use('/images', express.static(fallbackImagesPath));

  // Vite middleware setup
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
