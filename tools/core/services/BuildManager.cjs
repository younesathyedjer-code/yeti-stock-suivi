const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const CoreConfig = require('../config/CoreConfig.cjs');

class BuildManager {
  static runNpmInstallIfNeeded() {
    const rootDir = CoreConfig.paths.root;
    let needsInstall = false;

    if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
      console.log("ℹ Dossier node_modules absent. Lancement de npm install...");
      needsInstall = true;
    } else {
      // Comparer avec la dernière sauvegarde
      const backupDir = CoreConfig.paths.backup;
      if (fs.existsSync(backupDir)) {
        const backups = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('backup_'))
          .map(f => ({ name: f, time: parseInt(f.replace('backup_', '')) }))
          .sort((a, b) => b.time - a.time);
        
        if (backups.length > 0) {
          const latestBackupPkg = path.join(backupDir, backups[0].name, 'package.json');
          const currentPkg = path.join(rootDir, 'package.json');
          if (fs.existsSync(latestBackupPkg) && fs.existsSync(currentPkg)) {
            try {
              const oldPkg = JSON.parse(fs.readFileSync(latestBackupPkg, 'utf8'));
              const newPkg = JSON.parse(fs.readFileSync(currentPkg, 'utf8'));
              const oldDeps = JSON.stringify({ ...(oldPkg.dependencies || {}), ...(oldPkg.devDependencies || {}) });
              const newDeps = JSON.stringify({ ...(newPkg.dependencies || {}), ...(newPkg.devDependencies || {}) });
              if (oldDeps !== newDeps) {
                console.log("ℹ Détection de changements dans les dépendances de package.json. Lancement de npm install...");
                needsInstall = true;
              }
            } catch (e) {
              needsInstall = true;
            }
          }
        }
      }
    }

    if (needsInstall) {
      try {
        execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
        console.log("✓ npm install complété avec succès !");
        return true;
      } catch (err) {
        console.error("❌ Échec de npm install :", err.message);
        throw err;
      }
    } else {
      console.log("✓ Dépendances à jour (npm install non requis).");
      return false;
    }
  }

  static runWebBuild() {
    console.log("Exécution du build web demandé...");
    try {
      execSync(CoreConfig.commands.build, { cwd: CoreConfig.paths.root, stdio: 'inherit' });
      console.log("✓ Build web complété avec succès !");
      return true;
    } catch (err) {
      console.error("❌ Échec du build web :", err.message);
      throw err;
    }
  }

  static runCapacitorSync() {
    console.log("Exécution du Capacitor Sync demandé...");
    const rootDir = CoreConfig.paths.root;
    const pkgPath = path.join(rootDir, 'package.json');
    
    // 1. S'assurer que les packages Capacitor sont installés
    let hasCapacitor = false;
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps['@capacitor/core'] && deps['@capacitor/cli'] && deps['@capacitor/android']) {
          hasCapacitor = true;
        }
      } catch (err) {
        console.warn("⚠️ Erreur lors de la lecture de package.json pour Capacitor :", err.message);
      }
    }

    if (!hasCapacitor) {
      console.log("ℹ Dépendances Capacitor manquantes dans package.json. Installation automatique...");
      try {
        execSync('npm install @capacitor/core @capacitor/cli @capacitor/android', { cwd: rootDir, stdio: 'inherit' });
        console.log("✓ Packages Capacitor installés avec succès !");
      } catch (err) {
        console.error("❌ Échec de l'installation des dépendances Capacitor :", err.message);
        throw err;
      }
    }

    // 2. S'assurer que Capacitor est initialisé (présence de capacitor.config.json ou capacitor.config.ts etc.)
    const configFiles = [
      'capacitor.config.json',
      'capacitor.config.ts',
      'capacitor.config.js',
      'capacitor.config.mjs'
    ];
    const hasConfig = configFiles.some(file => fs.existsSync(path.join(rootDir, file)));

    if (!hasConfig) {
      console.log("ℹ Fichier de configuration Capacitor introuvable. Initialisation automatique de Capacitor...");
      try {
        // Initialiser avec des paramètres par défaut intelligents
        // --web-dir=dist est indispensable pour correspondre au dossier de build de Vite
        execSync('npx cap init "Adfar Stock Yeti" "com.yetistock.app" --web-dir=dist', { cwd: rootDir, stdio: 'inherit' });
        console.log("✓ Capacitor initialisé avec succès !");
      } catch (err) {
        console.error("❌ Échec de l'initialisation de Capacitor :", err.message);
        throw err;
      }
    }

    // 3. S'assurer que la plateforme Android est ajoutée (présence du dossier android/)
    const androidDir = CoreConfig.paths.android || path.join(rootDir, 'android');
    if (!fs.existsSync(androidDir)) {
      console.log("ℹ Plateforme Android manquante. Ajout automatique de la plateforme Android...");
      try {
        execSync('npx cap add android', { cwd: rootDir, stdio: 'inherit' });
        console.log("✓ Plateforme Android ajoutée avec succès !");
      } catch (err) {
        console.error("❌ Échec de l'ajout de la plateforme Android :", err.message);
        throw err;
      }
    }

    // 4. Exécuter le sync de Capacitor
    try {
      execSync(CoreConfig.commands.capSync, { cwd: rootDir, stdio: 'inherit' });
      console.log("✓ Capacitor Sync complété avec succès !");
      return true;
    } catch (err) {
      console.error("❌ Échec du Capacitor Sync :", err.message);
      throw err;
    }
  }

  static runFirebaseDeploy() {
    console.log("Exécution du Firebase Deploy demandé...");
    try {
      execSync(CoreConfig.commands.firebaseDeploy, { cwd: CoreConfig.paths.root, stdio: 'inherit' });
      console.log("✓ Firebase Deploy complété avec succès !");
      return true;
    } catch (err) {
      console.error("❌ Échec du Firebase Deploy :", err.message);
      throw err;
    }
  }
}

module.exports = BuildManager;
