# 🚀 Yeti Update Manager - Guide Complet & Mode d'Emploi

**Yeti Update Manager** est le moteur de mise à jour entièrement automatique, robuste et ultra-sécurisé conçu spécifiquement pour le workflow local Windows (React + Vite, Capacitor Android, GitHub).

---

## 📦 Installation Initiale dans Votre Projet Existant

Si vous possédez déjà une version de **YETISTOCK** en local sur votre PC et que vous souhaitez y ajouter uniquement le gestionnaire de mise à jour **sans écraser votre projet actuel**, il vous suffit d'ajouter ces **3 éléments clés** :

### 1. Le dossier `scripts/`
Copiez le fichier `scripts/yeti-update-manager.cjs` dans le dossier `scripts/` de votre projet local.

### 2. Le dossier `updates/`
Créez le dossier `updates/` à la racine de votre projet (avec un fichier `.gitkeep` vide à l'intérieur).

### 3. Les scripts dans `package.json`
Dans votre `package.json` local, ajoutez les deux lignes suivantes dans la section `"scripts"` :
```json
"scripts": {
  "yeti-update": "node scripts/yeti-update-manager.cjs",
  "yeti-rollback": "node scripts/yeti-update-manager.cjs --rollback"
}
```

### 4. Vérification du `.gitignore`
Assurez-vous que votre fichier `.gitignore` contient bien les exclusions suivantes :
```gitignore
.yeti_backups/
.yeti_tmp/
updates/
node_modules/
dist/
build/
android/app/build/
android/build/
.gradle/
android/.gradle/
*.apk
```

> **Note :** Tous les futurs fichiers ZIP téléchargés depuis Google AI Studio incluront déjà le script `scripts/yeti-update-manager.cjs` et sa configuration.

---

## ⚙️ Workflow de Mise à Jour Automatique

```text
Google AI Studio (ZIP) 
      ↓ 
Dépôt du ZIP dans /updates/
      ↓
npm run yeti-update
  ├── 1. Détection du ZIP
  ├── 2. Extraction temporaire (.yeti_tmp/)
  ├── 3. Validation exhaustive du ZIP (Structure, package.json, React, Capacitor, JSON)
  │      ↳ Si erreur : Annulation immédiate (aucun fichier modifié)
  ├── 4. Rapport de prévisualisation (Demande de confirmation : Continuer ? [O/n])
  │      ↳ Si 'N' : Annulation propre (aucun fichier modifié)
  ├── 5. Sauvegarde locale complète (.yeti_backups/) & Rétention auto (20 dernières)
  ├── 6. Remplacement sécurisé des fichiers du projet
  ├── 7. npm install (exécuté uniquement si les dépendances ont changé)
  ├── 8. npm run build
  ├── 9. npx cap sync android (si Android présent)
  ├── 10. Génération de l'APK Release (android/app/build/outputs/apk/release/app-release.apk)
  ├── 11. Git Add + Commit + Push (Message auto depuis manifest.json/metadata.json)
  └── 12. Archivage du ZIP de mise à jour dans updates/processed/
```

---

## 📋 Mode d'Emploi Quotidien

### 1. Lancer une Mise à Jour

1. Téléchargez le fichier ZIP généré par Google AI Studio.
2. Déposez-le dans le dossier `updates/` de votre projet.
3. Ouvrez un terminal dans votre projet et lancez :

```bash
npm run yeti-update
```

4. Le gestionnaire extrait le ZIP dans `.yeti_tmp/` et effectue la **validation complète** (fichiers indispensables, imports React, dépendances Capacitor, syntaxe JSON).
5. Il affiche le **rapport de prévisualisation** (version, description, fichiers ajoutés, modifiés, supprimés, dépendances).
6. Le système vous demande : `Continuer la mise à jour ? [O/n]`.
7. Tapez `O` puis `Entrée`.
8. Le gestionnaire crée la sauvegarde locale (avec nettoyage automatique pour ne conserver que les **20 plus récentes**), remplace les fichiers, exécute le build, synchronise Capacitor, génère l'APK Release, crée le commit Git structuré (ex: `Mise à jour v1.2.0 : Description du manifest.json`), effectue le push vers GitHub et **déplace le ZIP traité** dans `updates/processed/`.

---

### 2. Archivage Historique des ZIP
Les fichiers ZIP de mise à jour ne sont plus jamais supprimés après installation :
- Ils sont déplacés automatiquement dans `updates/processed/`.
- Cela vous permet de conserver l'historique complet de tous les fichiers ZIP reçus depuis Google AI Studio.
- Le dossier `updates/processed/` est exclu de Git via `.gitignore`.

---

### 3. Rétention Automatique des Sauvegardes
- Chaque mise à jour crée une sauvegarde complète horodatée dans `.yeti_backups/`.
- Le gestionnaire vérifie automatiquement le nombre de sauvegardes locales et conserve uniquement les **20 plus récentes**.
- Les sauvegardes plus anciennes sont purgées automatiquement pour libérer l'espace disque.

---

### 4. Messages Commit Git Autogénérés
- Le message de commit Git est généré automatiquement depuis les clés `version` et `description` de `manifest.json` (ou `metadata.json` / `package.json`).
- Format : `Mise à jour v1.x.x : <description_du_manifest>`
- L'historique des commits sur GitHub est ainsi clair, professionnel et parfaitement lisible.

---

### 5. Exclusion Permanente des Dossiers Locaux & Protections Sécurité
- **Dossiers Exclus Permanents :** Les dossiers locaux essentiels suivants ne sont jamais supprimés ni remplacés lors d'une mise à jour :
  - `android/` (configuration et code natif Android/APK)
  - `node_modules/` (dépendances installées)
  - `dist/` (build de production)
  - `.yeti_backups/` (sauvegardes automatiques)
  - `.git/` (historique et configuration Git)
- **Calcul de Diff Sécurisé :** Les fichiers contenus dans ces dossiers exclus ne sont jamais comptabilisés comme "supprimés" dans le rapport de prévisualisation.
- **Protection Contre la Suppression Massive (>50 Fichiers) :** Si une mise à jour prévoit la suppression de plus de 50 fichiers source, le processus est automatiquement bloqué et nécessite une confirmation explicite (en tapant `CONFIRMER` ou `OUI`).

---

### 6. Fusion Intelligente, Configuration Capacitor & Auto-Réparation Windows
- **Préservation de `capacitor.config.ts` :** Le fichier de configuration local `capacitor.config.ts` (ou `.json` / `.js`) n'est jamais écrasé ni remplacé par le fichier du ZIP d'exportation.
- **Détection Automatique de `webDir` :** Avant d'exécuter `npx cap sync android`, le gestionnaire analyse dynamiquement la valeur réelle de `webDir` (par ex. `dist`), l'affiche dans le journal de suivi (`ℹ Configuration Capacitor détectée : webDir = 'dist'`), et s'assure que le dossier des assets web existe et est prêt avant la synchronisation.
- **Nettoyage des Conflits de Configuration :** Si un fichier `capacitor.config.json` obsolète est présent aux côtés de `capacitor.config.ts`, il est automatiquement nettoyé pour éviter que le CLI Capacitor ne se trompe de dossier cible.
- **Protection Capacitor & Scripts dans `package.json` :** Lors du remplacement de `package.json`, le gestionnaire effectue une fusion intelligente qui préserve automatiquement vos dépendances locales Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, etc.) ainsi que vos scripts de mise à jour (`yeti-update`, `yeti-rollback`), même si le fichier ZIP exporté par AI Studio ne les inclut pas.
- **Réparation Automatique des Binaires Windows (Rollup / Esbuild) :** Si `npm run build` échoue en raison de modules natifs Windows manquants (ex: `@rollup/rollup-win32-x64-msvc`), le gestionnaire intercepte l'erreur, réinstalle automatiquement les binaires optionnels natifs via `npm install @rollup/rollup-win32-x64-msvc --no-save --force` et relance la compilation sans interrompre le processus.

---

### 7. Système de Rollback (Sécurité Absolue)

#### Rollback Automatique
Si une erreur survient à **n'importe quelle étape de construction** (`npm install`, `npm run build`, `npx cap sync android`, ou génération APK), Yeti Update Manager :
- Annule la mise à jour immédiatement.
- Restaure le projet local à 100% à partir de la sauvegarde créée.
- N'effectue **aucun commit Git** sur GitHub.

#### Rollback Manuel
Si la mise à jour s'est déroulée avec succès mais que le comportement de l'application ne vous convient pas, vous pouvez restaurer une version précédente à tout moment :

```bash
npm run yeti-rollback
```

1. La liste des sauvegardes locales dans `.yeti_backups/` s'affiche avec la date et l'heure exactes.
2. Sélectionnez le numéro de la sauvegarde à restaurer.
3. Le projet local est restauré instantanément.
4. **Sécurité GitHub :** Le rollback manuel modifie uniquement le projet local et ne touche jamais à votre dépôt GitHub distant.

---

## 📊 Rapport Final Détaillé

À la fin de chaque mise à jour réussie, un rapport complet et chronométré est affiché :

```text
====================================================
  RAPPORT FINAL DE MISE À JOUR - YETI UPDATE MANAGER
====================================================

  • Version installée          : v1.0.0
  • Sauvegarde créée           : C:\Projets\YETISTOCK\.yeti_backups\backup_2026-07-22_13-50-00
  • Durée totale de la MAJ     : 1 min 42 sec
  • Fichiers ajoutés           : 2
  • Fichiers modifiés          : 5
  • Fichiers supprimés         : 0
  • Résultat validation ZIP    : OK
  • Résultat npm install       : Ignoré (pas de changement)
  • Résultat Build             : OK (12 sec)
  • Résultat Capacitor Sync    : OK (8 sec)
  • Résultat Génération APK    : OK (1 min 15 sec)
  • Résultat Git Commit        : OK
  • Résultat Git Push (GitHub)  : OK

  Emplacement APK Release :
  ↳ C:\Projets\YETISTOCK\android\app\build\outputs\apk\release\app-release.apk

  Emplacement Sauvegarde Locale :
  ↳ C:\Projets\YETISTOCK\.yeti_backups\backup_2026-07-22_13-50-00

✓ Mise à jour entièrement terminée et sécurisée avec succès !
```

---

## 🛡️ Fichiers Exclus de GitHub
GitHub reste exclusivement un miroir du code source propre. Les éléments suivants sont **systématiquement ignorés** et ne seront jamais poussés sur GitHub :
- `.yeti_backups/`
- `.yeti_tmp/`
- `updates/`
- `node_modules/`
- `dist/` & `build/`
- `android/app/build/`
- `*.apk`
