# Certificats automatiques — AcadémieWeb

## Fichiers inclus

| Fichier | Rôle |
|---|---|
| `certificate-template.html` | Le design du certificat (modifie ce fichier pour changer l'apparence) |
| `generate-certificate.js` | La logique de génération PDF + upload Supabase |
| `integration-example.js` | Comment déclencher le certificat depuis ton site |

---

## Mise en place rapide (5 étapes)

### 1. Supabase — Créer les tables
Copie-colle les requêtes SQL du bas de `integration-example.js`
dans ton **SQL Editor** Supabase.

### 2. Supabase — Créer les buckets Storage
Dans ton dashboard Supabase > **Storage** > **New bucket** :
- `certificats` → cocher "Public bucket"
- `signatures`  → cocher "Public bucket"

### 3. Uploader les signatures
Dans le bucket `signatures`, uploade tes images de signature
(PNG transparent recommandé). Mets à jour les noms de fichiers
dans `generate-certificate.js` dans la section `SIGNATURES`.

### 4. Mettre tes clés Supabase
Dans `generate-certificate.js` et `integration-example.js`,
remplace :
```
const SUPABASE_URL  = 'https://XXXXXXXXXXXX.supabase.co';
const SUPABASE_ANON = 'ta-clé-anon-ici';
```
Tes clés sont dans : Supabase Dashboard > Settings > API.

### 5. Ajouter html2pdf.js dans ton HTML
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
```

---

## Comment personnaliser le design

Tout le design est dans `certificate-template.html`.
Les variables à injecter sont entre doubles accolades : `{{NOM}}`, `{{COURS}}`, etc.

| Variable | Contenu |
|---|---|
| `{{NOM}}` | Nom complet de l'élève |
| `{{COURS}}` | Titre du cours |
| `{{DUREE}}` | Durée formatée (ex: 12 heures) |
| `{{DATE}}` | Date d'obtention |
| `{{CERT_ID}}` | Numéro unique du certificat |
| `{{SIG1_URL}}` | URL de la signature 1 |
| `{{SIG1_NOM}}` | Nom du signataire 1 |
| `{{SIG1_ROLE}}` | Rôle du signataire 1 |
| `{{SIG2_URL}}` | URL de la signature 2 |
| `{{SIG2_NOM}}` | Nom du signataire 2 |
| `{{SIG2_ROLE}}` | Rôle du signataire 2 |

Pour ajouter ton logo, décommente la ligne `<img src="{{LOGO_URL}}"...>`
dans `certificate-template.html` et remplace `{{LOGO_URL}}` par l'URL
publique de ton logo dans Supabase Storage.

---

## Déclenchement automatique

```js
// Quand l'élève clique "Terminer le cours"
await onCourseCompleted('uuid-du-cours');

// Depuis un bouton dans ton HTML
<button onclick="onCourseCompleted('uuid-cours')">Terminer</button>
```

Le certificat est ensuite accessible via l'URL retournée,
et enregistré dans la table `certificats` pour l'afficher
sur le profil de l'élève.
