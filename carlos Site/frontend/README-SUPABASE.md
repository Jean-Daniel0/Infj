# Configuration Supabase pour INFJ

Ce guide vous explique comment configurer Supabase comme backend pour l'Institut National de Formation des Jeunes.

## 🚀 Étapes de configuration

### 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur "New Project"
4. Choisissez votre organisation
5. Donnez un nom à votre projet (ex: "infj-backend")
6. Créez un mot de passe fort pour la base de données
7. Sélectionnez une région proche de vos utilisateurs
8. Cliquez sur "Create new project"

### 2. Configurer les variables d'environnement

1. Copiez le fichier `env.example` vers `.env`
2. Dans votre dashboard Supabase, allez dans Settings > API
3. Copiez l'URL du projet et la clé publique anonyme
4. Mettez à jour votre fichier `.env` :

```env
VITE_SUPABASE_URL=https://votre-projet-id.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-publique-ici
```

### 3. Configurer la base de données

1. Dans votre dashboard Supabase, allez dans l'éditeur SQL
2. Copiez et exécutez le contenu du fichier `database-schema.sql`
3. Vérifiez que toutes les tables ont été créées dans l'onglet "Table Editor"

### 4. Configurer l'authentification

1. Allez dans Authentication > Settings
2. Activez "Enable email confirmations" si souhaité
3. Configurez les providers d'authentification (email/password par défaut)
4. Personnalisez les templates d'email si nécessaire

### 5. Configurer les politiques de sécurité (RLS)

Les politiques Row Level Security sont déjà définies dans le schéma SQL. Elles permettent :
- Les utilisateurs peuvent voir leurs propres données
- Les admins peuvent gérer toutes les données
- Les visiteurs peuvent créer des contacts et s'inscrire aux formations

### 6. Créer un utilisateur admin

1. Allez dans Authentication > Users
2. Cliquez sur "Add user"
3. Créez un utilisateur admin avec un email et mot de passe
4. Dans l'éditeur SQL, exécutez :

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'votre-email-admin@example.com';
```

## 📁 Structure des fichiers

```
frontend/
├── supabase-config.js      # Configuration Supabase
├── auth.js                  # Gestion de l'authentification
├── script.js               # Scripts frontend mis à jour
├── database-schema.sql     # Schéma de base de données
├── package.json           # Dépendances Node.js
├── vite.config.js        # Configuration Vite
└── env.example           # Variables d'environnement
```

## 🔧 Fonctionnalités implémentées

### Authentification
- ✅ Inscription/Connexion des utilisateurs
- ✅ Gestion des sessions
- ✅ Rôles utilisateur (user/admin)
- ✅ Interface d'authentification

### Formations
- ✅ CRUD des formations
- ✅ Inscription aux formations
- ✅ Gestion des places disponibles
- ✅ Système de certificats

### Contacts
- ✅ Envoi de messages
- ✅ Gestion des statuts
- ✅ Interface admin pour les réponses

### Base de données
- ✅ Tables optimisées avec index
- ✅ Politiques de sécurité (RLS)
- ✅ Triggers pour les mises à jour
- ✅ Fonctions utilitaires

## 🚀 Déploiement

### Développement local
```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

### Production
```bash
# Construire le projet
npm run build

# Servir les fichiers statiques
npm run serve
```

## 🔒 Sécurité

- Toutes les tables ont des politiques RLS activées
- Les utilisateurs ne peuvent accéder qu'à leurs propres données
- Les admins ont accès complet via l'interface
- Validation des données côté client et serveur

## 📞 Support

Pour toute question sur la configuration Supabase :
1. Consultez la [documentation Supabase](https://supabase.com/docs)
2. Vérifiez les logs dans votre dashboard Supabase
3. Testez les API dans l'onglet "API" du dashboard

## 🎯 Prochaines étapes

1. **Tester l'authentification** : Créez un compte et connectez-vous
2. **Tester les formations** : Ajoutez des formations via l'interface admin
3. **Tester les contacts** : Envoyez des messages via le formulaire
4. **Personnaliser** : Adaptez les templates et les couleurs selon vos besoins



