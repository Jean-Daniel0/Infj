# Correction de l'erreur Supabase - Utilisation du CDN

## Problème

L'erreur `Failed to resolve module specifier "@supabase/supabase-js"` se produit parce que les modules ES6 natifs dans le navigateur ne peuvent pas importer directement des packages npm.

## Solution

Utilisation du CDN Supabase au lieu de l'import npm.

## Modifications effectuées

### 1. `frontend/supabase-config.js`
- **Avant** : `import { createClient } from '@supabase/supabase-js'`
- **Après** : Utilisation de `window.supabase` depuis le CDN
- Le CDN doit être chargé dans le HTML avant ce module

### 2. Ajout du CDN Supabase dans tous les fichiers HTML

Le script CDN a été ajouté dans le `<head>` de toutes les pages qui utilisent Supabase :

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**Fichiers modifiés** :
- ✅ `login.html`
- ✅ `register.html`
- ✅ `cours.html`
- ✅ `video.html`
- ✅ `contact.html`
- ✅ `index.html`
- ✅ `formation.html`

## Ordre de chargement

L'ordre de chargement est important :

1. **CDN Supabase** (dans le `<head>`) :
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```

2. **Modules JavaScript** (à la fin du `<body>`) :
   ```html
   <script type="module" src="auth.js"></script>
   <script type="module" src="courses.js"></script>
   ```

## Fonctionnement

1. Le CDN charge Supabase et le rend disponible globalement via `window.supabase`
2. `supabase-config.js` utilise `window.supabase.createClient()` pour créer le client
3. Les autres modules importent depuis `supabase-config.js` qui exporte le client créé

## Avantages

- ✅ Pas besoin d'installer les dépendances npm
- ✅ Fonctionne directement dans le navigateur
- ✅ Compatible avec les modules ES6 natifs
- ✅ Pas besoin de bundler (Vite, Webpack, etc.)

## Alternative (si vous utilisez Vite)

Si vous utilisez Vite pour le développement, vous pouvez :
1. Installer les dépendances : `npm install`
2. Lancer Vite : `npm run dev`
3. Vite bundlera automatiquement les imports npm

Mais pour un déploiement statique sur Netlify, le CDN est la meilleure solution.

## Test

Pour vérifier que tout fonctionne :

1. Ouvrir la console du navigateur (F12)
2. Vérifier qu'il n'y a plus d'erreur "Failed to resolve module specifier"
3. Vérifier que `window.supabase` est disponible dans la console
4. Tester les fonctionnalités qui utilisent Supabase (connexion, inscription, etc.)

