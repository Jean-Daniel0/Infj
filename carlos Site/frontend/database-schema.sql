-- =====================================================================
-- SCHEMA DE BASE DE DONNEES ET POLITIQUES RLS - INFJ
-- Copiez et collez ce script complet dans l'éditeur SQL de votre console Supabase:
-- https://supabase.com -> Votre Projet -> SQL Editor -> New Query
-- =====================================================================

-- 1. NETTOYAGE (Optionnel mais recommandé pour repartir sur de bonnes bases)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TABLE IF EXISTS public.certificats CASCADE;
DROP TABLE IF EXISTS public.inscriptions CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.cours_videos CASCADE;
DROP TABLE IF EXISTS public.formations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. TABLE DES UTILISATEURS (Liée à l'authentification Supabase Auth)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nom TEXT,
  prenom TEXT,
  telephone TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLE DES FORMATIONS
CREATE TABLE public.formations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  modules JSONB, -- Contient la liste des chapitres de la formation
  duree TEXT,
  modalite TEXT,
  prix DECIMAL(10,2) DEFAULT 0,
  gratuit BOOLEAN DEFAULT true,
  date_debut TIMESTAMP WITH TIME ZONE,
  date_fin TIMESTAMP WITH TIME ZONE,
  places_max INTEGER,
  places_restantes INTEGER,
  statut TEXT DEFAULT 'active' CHECK (statut IN ('active', 'inactive', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.5. TABLE DES THÉMATIQUES DE COURS VIDÉOS
CREATE TABLE public.cours_videos (
  id TEXT PRIMARY KEY, -- Slug servant d'identifiant (ex: 'leadership', 'web')
  titre TEXT NOT NULL,
  description TEXT,
  prix DECIMAL(10,2) DEFAULT 0,
  gratuit BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLE DES MESSAGES DE CONTACT
CREATE TABLE public.contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  sujet TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'lu', 'repondu', 'archive')),
  reponse TEXT,
  reponse_par UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLE DES INSCRIPTIONS AUX COURS (ET ACHAT DE COURS VIDEOS)
CREATE TABLE public.inscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  formation_id UUID REFERENCES public.formations(id) ON DELETE CASCADE, -- Optionnel si achat d'un cours_video
  cours_video_id TEXT, -- Optionnel si inscription à une formation classique
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  motivation TEXT,
  status TEXT DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'acceptee', 'refusee', 'annulee')),
  certificat_emission BOOLEAN DEFAULT false,
  certificat_date TIMESTAMP WITH TIME ZONE,
  methode_paiement TEXT, -- 'MonCash', 'Virement', 'Carte'
  reference_paiement TEXT,
  recu_paiement_url TEXT,
  montant_paye DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, formation_id)
);

-- 6. TABLE DES CERTIFICATS
CREATE TABLE public.certificats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inscription_id UUID REFERENCES public.inscriptions(id) ON DELETE CASCADE,
  formation_id UUID REFERENCES public.formations(id) ON DELETE CASCADE,
  numero_certificat TEXT UNIQUE NOT NULL,
  pdf_url TEXT,
  date_emission TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_expiration TIMESTAMP WITH TIME ZONE,
  statut TEXT DEFAULT 'valide' CHECK (statut IN ('valide', 'expire', 'revoke')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.5. TABLE DES COMPLETIONS (FORMATION COMPLÉTÉE)
CREATE TABLE public.completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inscription_id UUID REFERENCES public.inscriptions(id) ON DELETE CASCADE,
  formation_id UUID REFERENCES public.formations(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT completions_inscription_id_formation_id_key UNIQUE (inscription_id, formation_id)
);


-- 7. INDEX POUR LES PERFORMANCES
CREATE INDEX idx_formations_statut ON public.formations(statut);
CREATE INDEX idx_contacts_status ON public.contacts(status);
CREATE INDEX idx_inscriptions_user_id ON public.inscriptions(user_id);
CREATE INDEX idx_inscriptions_status ON public.inscriptions(status);

-- 8. TRIGGER POUR METTRE A JOUR LA DATE 'updated_at' AUTOMATIQUEMENT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_formations_updated_at BEFORE UPDATE ON public.formations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inscriptions_updated_at BEFORE UPDATE ON public.inscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cours_videos_updated_at BEFORE UPDATE ON public.cours_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================================
-- 9. TRIGGER ESSENTIEL : SYNCHRONISATION AUTOMATIQUE DES PROFILS
-- Lorsque l'étudiant s'inscrit sur le site (auth.users), un profil correspondant
-- est automatiquement inséré dans public.users avec ses métadonnées (prenom, nom, etc.)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nom, prenom, telephone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
    CASE 
      WHEN NEW.email = 'mradmin@infj.com' THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =====================================================================
-- 10. ACTIVATION INTERNE DE LA SECURITE ROW LEVEL SECURITY (RLS)
-- Cela bloque tout accès non explicité par une règle d'autorisation
-- =====================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificats ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- 11. DEFINITION DES POLITIQUES DE SECURITE RLS DETAILLEES
-- =====================================================================

-- ----- A. POLITIQUES POUR 'public.users' -----
-- Autoriser les utilisateurs à voir uniquement leur propre profil
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT TO authenticated 
USING (auth.uid() = id);

-- Autoriser les utilisateurs à mettre à jour uniquement leur propre profil
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE TO authenticated 
USING (auth.uid() = id);

-- Autoriser les administrateurs à voir tous les profils (évite la récursion infinie)
CREATE POLICY "Admins can view all profiles" 
ON public.users FOR SELECT TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- Autoriser les administrateurs à mettre à jour tous les profils
CREATE POLICY "Admins can update all profiles" 
ON public.users FOR UPDATE TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


-- ----- B. POLITIQUES POUR 'public.formations' -----
-- Tout le monde (invités compris) peut voir les cours
CREATE POLICY "Formations are viewable by everyone" 
ON public.formations FOR SELECT USING (true);

-- Seuls les administrateurs ont le contrôle total (Ajout, Édition, Suppression)
CREATE POLICY "Only admins can manage formations" 
ON public.formations FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


-- ----- B.5. POLITIQUES POUR 'public.cours_videos' -----
ALTER TABLE public.cours_videos ENABLE ROW LEVEL SECURITY;

-- Tout le monde (invités compris) peut voir les cours vidéos
CREATE POLICY "Cours videos are viewable by everyone" 
ON public.cours_videos FOR SELECT USING (true);

-- Seuls les administrateurs ont le contrôle total (Ajout, Édition, Suppression)
CREATE POLICY "Only admins can manage cours videos" 
ON public.cours_videos FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


-- ----- C. POLITIQUES POUR 'public.contacts' -----
-- Autoriser tout le monde à envoyer un message de contact
CREATE POLICY "Anyone can create contacts" 
ON public.contacts FOR INSERT WITH CHECK (true);

-- Seuls les admins peuvent consulter et traiter les messages
CREATE POLICY "Only admins can view contacts" 
ON public.contacts FOR SELECT TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Only admins can update contacts" 
ON public.contacts FOR UPDATE TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


-- ----- D. POLITIQUES POUR 'public.inscriptions' -----
-- Permettre à tout utilisateur authentifié de s'inscrire à un cours
CREATE POLICY "Authenticated users can enroll" 
ON public.inscriptions FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Permettre aux utilisateurs de voir leurs propres inscriptions
CREATE POLICY "Users can view own inscriptions" 
ON public.inscriptions FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- Politique administrateur : voir et valider toutes les inscriptions
CREATE POLICY "Admins can manage all inscriptions" 
ON public.inscriptions FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- Permettre aux étudiants de mettre à jour le statut certificat de leur propre inscription
CREATE POLICY "Users can update own certificate status" 
ON public.inscriptions FOR UPDATE TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- ----- E. POLITIQUES POUR 'public.certificats' -----
-- Permettre aux utilisateurs de voir leurs propres diplômes/certificats
CREATE POLICY "Users can view own certificates" 
ON public.certificats FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.inscriptions 
    WHERE id = certificats.inscription_id AND user_id = auth.uid()
  )
);

-- Permettre aux étudiants de générer leur propre certificat
CREATE POLICY "Users can insert own certificates" 
ON public.certificats FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.inscriptions 
    WHERE id = inscription_id AND user_id = auth.uid()
  )
);

-- Politique administrateur : Gérer tous les certificats
CREATE POLICY "Only admins can manage certificates" 
ON public.certificats FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


-- ----- E.5. POLITIQUES POUR 'public.completions' -----
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own completions" 
ON public.completions FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.inscriptions 
    WHERE id = completions.inscription_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all completions" 
ON public.completions FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


-- =====================================================================
-- 12. TABLES POUR LES VISIOCONFERENCES (JITSI LIVE & FEUILLE DE PRESENCE)
-- =====================================================================
CREATE TABLE public.live_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  course_id TEXT DEFAULT 'general',
  meeting_id TEXT UNIQUE NOT NULL,
  statut TEXT DEFAULT 'planifie' CHECK (statut IN ('planifie', 'en_cours', 'termine', 'annule')),
  date_prevue TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_fin TIMESTAMP WITH TIME ZONE,
  mot_de_passe TEXT,
  max_participants INTEGER DEFAULT 50,
  gratuit BOOLEAN DEFAULT true,
  prix DECIMAL(10,2) DEFAULT 0,
  enregistrement_url TEXT,
  is_active BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.live_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nom_complet TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  duree_presence INTEGER DEFAULT 0, -- durée en minutes
  a_acces BOOLEAN DEFAULT true,
  UNIQUE(session_id, user_id) -- Garantit l'absence de doublons de présence par cours
);

-- Index pour accélérer les jointures et requêtes en direct
CREATE INDEX idx_live_sessions_active ON public.live_sessions(is_active);
CREATE INDEX idx_live_attendance_session ON public.live_attendance(session_id);

-- Triggers de mise à jour de la date updated_at
CREATE TRIGGER update_live_sessions_updated_at BEFORE UPDATE ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activation de la protection RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_attendance ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour s'assurer que seuls les admins ont plein pouvoir de gestion,
-- et les étudiants peuvent s'enregistrer et voir les sessions

-- ----- Politiques de 'live_sessions' -----
DROP POLICY IF EXISTS "Sessions actives visualisables par les authentifies" ON public.live_sessions;
-- Les étudiants et invités authentifiés peuvent voir les visioconférences en direct
CREATE POLICY "Sessions actives visualisables par les authentifies"
ON public.live_sessions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Modification totale par les admins uniquement" ON public.live_sessions;
-- Seul l'administrateur système peut créer, modifier ou supprimer des cours de direct
CREATE POLICY "Modification totale par les admins uniquement"
ON public.live_sessions FOR ALL TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- ----- Politiques de 'live_attendance' -----
DROP POLICY IF EXISTS "Les etudiants peuvent enregistrer leur presence" ON public.live_attendance;
-- Permettre à tout étudiant authentifié de s'enregistrer et de prouver sa présence en direct
CREATE POLICY "Les etudiants peuvent enregistrer leur presence"
ON public.live_attendance FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les etudiants peuvent mettre a jour leur heartbeat" ON public.live_attendance;
-- Permettre à l'étudiant de mettre à jour son battement de coeur d'activité (heartbeat)
CREATE POLICY "Les etudiants peuvent mettre a jour leur heartbeat"
ON public.live_attendance FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les etudiants peuvent voir leurs propres presences" ON public.live_attendance;
-- L'étudiant peut voir ses propres statistiques de présence
CREATE POLICY "Les etudiants peuvent voir leurs propres presences"
ON public.live_attendance FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les admins peuvent voir toutes les presences de tous les cours" ON public.live_attendance;
-- L'administrateur peut voir et exporter absolument toutes les participations de présence
CREATE POLICY "Les admins peuvent voir toutes les presences de tous les cours"
ON public.live_attendance FOR SELECT TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);


-- =====================================================================
-- 13. INSERTION DU PREMIER COURS DE LEADERSHIP PAR DEFAUT
-- =====================================================================
INSERT INTO public.formations (titre, description, modules, duree, modalite, gratuit, places_max, places_restantes) VALUES
(
    'Formation intensive en LEADERSHIP ORGANISATIONNEL',
    'Développez vos compétences de leader et boostez votre carrière !',
    '[
        "Introduction au leadership organisationnel",
        "Développement personnel du leader", 
        "Prise de parole en public",
        "Gestion du temps et des priorités",
        "Management des équipes",
        "Communication en organisation",
        "Gestion des conflits",
        "Prise de décisions stratégiques"
    ]'::jsonb,
    '8 semaines',
    'En ligne',
    true,
    50,
    50
) ON CONFLICT DO NOTHING;

-- =====================================================================
-- 14. POLITIQUES RLS POUR LE STOCKAGE SUPABASE (STORAGE.OBJECTS)
-- =====================================================================

-- S'assurer que les buckets existent
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificats', 'certificats', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cours', 'cours', true)
ON CONFLICT (id) DO NOTHING;

-- Désactiver et nettoyer les anciennes politiques pour éviter les conflits
DROP POLICY IF EXISTS "Permettre aux etudiants authentifies de lire les cours" ON storage.objects;
DROP POLICY IF EXISTS "Permettre l'acces total aux administrateurs sur le stockage" ON storage.objects;
DROP POLICY IF EXISTS "Permettre aux etudiants de lire les certificats" ON storage.objects;
DROP POLICY IF EXISTS "Permettre l'acces total administrateur aux certificats" ON storage.objects;
DROP POLICY IF EXISTS "Accès public en lecture pour tous" ON storage.objects;
DROP POLICY IF EXISTS "Accès total administrateur sur le stockage" ON storage.objects;

-- Politique 1 : Autoriser la lecture publique (anonyme et authentifiée) de tous les buckets publics pour simplifier le rendu des images et PDF
CREATE POLICY "Accès public en lecture pour tous"
ON storage.objects FOR SELECT TO public
USING (bucket_id IN ('videos', 'certificats', 'cours'));

-- Politique 2 : Autoriser uniquement les administrateurs à TOUT faire (Insérer, Mettre à jour, Supprimer, etc.) dans tous les buckets
CREATE POLICY "Accès total administrateur sur le stockage"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id IN ('videos', 'certificats', 'cours') AND 
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  bucket_id IN ('videos', 'certificats', 'cours') AND 
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- *********************************************************************
-- CONSEIL ADMIN : Comment désigner un utilisateur existant comme administrateur ?
-- Exécutez cette ligne un fois l'utilisateur inscrit sur le site :
-- UPDATE public.users SET role = 'admin' WHERE email = 'votre-email@example.com';
-- *********************************************************************
