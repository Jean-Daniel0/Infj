# Page Vidéo - Documentation

## Description

La page `video.html` est dédiée à l'affichage des vidéos de chaque cours. Elle récupère automatiquement les vidéos depuis **Supabase Storage** et les affiche dans une interface moderne et intuitive.

## Fonctionnalités

### 1. Affichage des vidéos par cours
- Récupération automatique des vidéos depuis Supabase Storage
- Affichage en grille responsive
- Support de plusieurs types de cours :
  - `web` ou `creation-site-web` : Création de Site Web
  - `leadership` : Leadership Organisationnel
  - `entrepreneuriat` : Entrepreneuriat
  - `communication` : Communication
  - `marketing` : Marketing Digital
  - `dropshipping` : Dropshipping

### 2. Lecteur vidéo intégré
- Modal plein écran pour la lecture
- Contrôles vidéo natifs du navigateur
- Fermeture avec la touche Échap ou clic en dehors
- Affichage du titre de la vidéo
- Description affichée sous le lecteur

### 3. Informations sur les vidéos
- Miniature (thumbnail) si disponible
- Numéro de la vidéo dans la séquence
- Durée de la vidéo
- Nombre de vues
- Titre de la vidéo

## Utilisation

### Accès direct
```
video.html?course=web
```

### Depuis les autres pages

#### Depuis `formation.html`
Les boutons "Accéder à la formation" redirigent vers :
- Si connecté : `video.html?course={courseType}`
- Si non connecté : `register.html`

#### Depuis `cours.html`
Les boutons "Continuer la formation" redirigent vers :
- `video.html?course={courseId}`

### Types de cours supportés

| Type | URL | Description |
|------|-----|-------------|
| `web` | `video.html?course=web` | Création de Site Web (4 vidéos) |
| `leadership` | `video.html?course=leadership` | Leadership Organisationnel |
| `entrepreneuriat` | `video.html?course=entrepreneuriat` | Entrepreneuriat |
| `communication` | `video.html?course=communication` | Communication |
| `marketing` | `video.html?course=marketing` | Marketing Digital |
| `dropshipping` | `video.html?course=dropshipping` | Dropshipping |

## Structure des fichiers

### `video.html`
- Structure HTML de la page
- Styles CSS intégrés
- Modal pour le lecteur vidéo

### `video.js`
- Logique de récupération des vidéos
- Affichage des vidéos en grille
- Gestion du lecteur vidéo
- Mapping des types de cours

## Intégration avec Supabase Storage

La page utilise le module `supabase-videos.js` pour récupérer les vidéos :

```javascript
import { getCourseVideos } from './supabase-videos.js'

const { videos } = await getCourseVideos('web')
```

### Configuration requise

1. **Supabase Storage** :
   - Créez un bucket `videos` (ou changez le nom dans `frontend/config.js`)
   - Ajoutez un dossier par cours : `web`, `leadership`, `entrepreneuriat`, `communication`, `marketing`, `dropshipping`
   - Chargez vos fichiers vidéo dans le dossier correspondant

2. **Accès au bucket** :
   - Recommandé: bucket public pour un accès direct (ou utiliser des URLs signées si privé)

### Manifest (titres + descriptions par vidéo)

Pour gérer les titres, l’ordre et la description des vidéos, ajoutez un `manifest.json` dans chaque dossier de cours.

Exemple: `videos/web/manifest.json`

```json
{
  "courseTitle": "Création de Site Web",
  "courseDescription": "Apprenez à créer un site moderne de A à Z.",
  "videos": [
    {
      "file": "01-introduction.mp4",
      "title": "Introduction",
      "description": "Présentation du cours et des objectifs.",
      "order": 1,
      "thumbnail": "01-introduction.jpg"
    },
    {
      "file": "02-html-base.mp4",
      "title": "Les bases du HTML",
      "description": "Structure, balises et bonnes pratiques.",
      "order": 2
    }
  ]
}
```

Notes :
- `file` doit correspondre au nom du fichier vidéo dans le dossier.
- `thumbnail` est optionnel (chemin relatif dans le dossier ou URL complète).
- La description est affichée sous le lecteur vidéo.

## Interface utilisateur

### État de chargement
Affiche "Chargement des vidéos..." pendant la récupération des données.

### État vide
Affiche un message si aucune vidéo n'est disponible pour le cours.

### Grille de vidéos
- Cartes vidéo avec miniature
- Numéro de la vidéo
- Titre et métadonnées
- Effet hover pour l'interaction

### Lecteur vidéo
- Modal plein écran
- Contrôles vidéo
- Bouton de fermeture
- Titre de la vidéo

## Navigation

La page est accessible depuis :
- La barre de navigation (lien "Vidéos")
- Les boutons "Accéder à la formation" dans `formation.html`
- Les boutons "Continuer la formation" dans `cours.html`

## Responsive Design

La page est entièrement responsive :
- Grille adaptative selon la taille d'écran
- Modal vidéo optimisée pour mobile
- Navigation adaptée

## Gestion des erreurs

- Affichage d'un message d'erreur en cas d'échec de chargement
- Gestion des vidéos sans miniature
- Gestion des vidéos sans métadonnées

## Améliorations futures

- [ ] Ajout d'une barre de progression pour chaque vidéo
- [ ] Sauvegarde de la dernière vidéo regardée
- [ ] Filtres et recherche de vidéos
- [ ] Sous-titres et transcriptions
- [ ] Qualité vidéo sélectionnable (480p, 720p, 1080p)
- [ ] Mode lecture automatique (playlist)

