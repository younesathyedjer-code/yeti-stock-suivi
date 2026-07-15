const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const CoreConfig = require('./config/CoreConfig.cjs');

class UpdateEngine {
  constructor() {
    this.backupPath = null;
  }

  // Détecte, sauvegarde et extrait le package ZIP s'il existe
  extractLatestZipIfExists() {
    const updatesDir = CoreConfig.paths.updates;
    if (!fs.existsSync(updatesDir)) {
      fs.mkdirSync(updatesDir, { recursive: true });
      return false;
    }

    const files = fs.readdirSync(updatesDir);
    const zipFiles = files.filter(f => f.endsWith('.zip'));

    if (zipFiles.length === 0) {
      console.log("ℹ Aucun fichier de mise à jour (.zip) détecté dans le dossier /updates.");
      console.log("Exécution de l'orchestrateur avec le code source actuellement en place.");
      return false;
    }

    // Prendre le fichier ZIP le plus récent
    const latestZip = zipFiles
      .map(f => ({ name: f, time: fs.statSync(path.join(updatesDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)[0].name;

    const zipFilePath = path.join(updatesDir, latestZip);
    console.log(`\n📦 PAQUET DE MISE À JOUR DÉTECTÉ : ${latestZip}`);
    
    // Étape obligée : sauvegarder d'abord l'état actuel avant toute opération d'extraction
    this.backup();

    const tempPath = path.join(updatesDir, 'temp_update');
    if (fs.existsSync(tempPath)) {
      this._rmDirRecursive(tempPath);
    }
    fs.mkdirSync(tempPath, { recursive: true });

    console.log(`Extraction du fichier ZIP vers un dossier temporaire...`);
    try {
      const isWindows = process.platform === 'win32';
      // Tentative d'extraction native avec tar (très rapide, standard sous Windows 10/11 et Unix)
      try {
        execSync(`tar -xf "${zipFilePath}" -C "${tempPath}"`, { stdio: 'ignore' });
      } catch (tarErr) {
        if (isWindows) {
          // Fallback ultra-robuste spécifique à Windows (PowerShell Expand-Archive)
          console.log("Le tar natif a échoué. Tentative de fallback via PowerShell...");
          execSync(`powershell -Command "Expand-Archive -Path '${zipFilePath}' -DestinationPath '${tempPath}' -Force"`, { stdio: 'inherit' });
        } else {
          throw tarErr;
        }
      }

      console.log("Extraction complétée. Analyse du contenu...");

      // Le ZIP peut contenir les dossiers "src" et "manifest.json" à sa racine.
      // Cherchons-les dans temp_update
      let srcSource = path.join(tempPath, 'src');
      let manifestSource = path.join(tempPath, 'manifest.json');

      // Si le ZIP a été empaqueté avec un dossier parent intermédiaire (ex: yeti-update/src)
      if (!fs.existsSync(srcSource)) {
        const subdirs = fs.readdirSync(tempPath).filter(f => fs.statSync(path.join(tempPath, f)).isDirectory());
        if (subdirs.length === 1) {
          const nestedPath = path.join(tempPath, subdirs[0]);
          if (fs.existsSync(path.join(nestedPath, 'src'))) {
            srcSource = path.join(nestedPath, 'src');
            manifestSource = path.join(nestedPath, 'manifest.json');
          }
        }
      }

      if (!fs.existsSync(srcSource)) {
        throw new Error("Le package ZIP ne contient pas de dossier 'src' valide à sa racine.");
      }

      console.log("Application de la nouvelle mise à jour...");

      // 1. Remplacement de src/
      if (fs.existsSync(CoreConfig.paths.src)) {
        this._rmDirRecursive(CoreConfig.paths.src);
      }
      this._copyDirRecursive(srcSource, CoreConfig.paths.src);
      console.log("✓ Dossier /src mis à jour avec succès.");

      // 2. Remplacement du manifest.json s'il existe dans l'archive
      if (fs.existsSync(manifestSource)) {
        fs.copyFileSync(manifestSource, CoreConfig.paths.manifest);
        console.log("✓ Fichier manifest.json mis à jour avec succès.");
      } else {
        console.log("ℹ manifest.json absent du ZIP. Conservation du manifest actuel.");
      }

      // 3. Archivage du fichier ZIP traité pour ne pas le ré-extraire
      const processedDir = path.join(updatesDir, 'processed');
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }
      const destZipPath = path.join(processedDir, `${Date.now()}_${latestZip}`);
      fs.renameSync(zipFilePath, destZipPath);
      console.log(`✓ Fichier ZIP archivé vers : updates/processed/${path.basename(destZipPath)}`);

      // 4. Nettoyer le dossier temporaire
      this._rmDirRecursive(tempPath);
      return true;

    } catch (err) {
      console.error("❌ Échec critique lors du traitement du ZIP :", err.message);
      // Nettoyage
      if (fs.existsSync(tempPath)) {
        this._rmDirRecursive(tempPath);
      }
      throw err; // Déclenchera le rollback globale
    }
  }

  // Crée une sauvegarde préventive du dossier src (et d'autres fichiers sensibles)
  backup() {
    if (this.backupPath) {
      console.log(`ℹ Une sauvegarde de sécurité existe déjà à : ${this.backupPath}`);
      return true;
    }
    console.log("Initialisation de BackupManager...");
    const timestamp = Date.now();
    const backupDirName = `backup_${timestamp}`;
    this.backupPath = path.join(CoreConfig.paths.backup, backupDirName);

    try {
      if (!fs.existsSync(CoreConfig.paths.backup)) {
        fs.mkdirSync(CoreConfig.paths.backup, { recursive: true });
      }

      console.log(`Sauvegarde en cours vers : ${this.backupPath}...`);
      
      // Recursive copy helper
      this._copyDirRecursive(CoreConfig.paths.src, path.join(this.backupPath, 'src'));
      
      // Backup manifest too if exists
      if (fs.existsSync(CoreConfig.paths.manifest)) {
        fs.copyFileSync(CoreConfig.paths.manifest, path.join(this.backupPath, 'manifest.json'));
      }

      console.log("✓ Sauvegarde effectuée avec succès.");
      return true;
    } catch (err) {
      console.error("❌ Échec de la sauvegarde préventive :", err.message);
      throw err;
    }
  }

  // Restaure l'état en cas d'erreur (Rollback)
  rollback() {
    if (!this.backupPath || !fs.existsSync(this.backupPath)) {
      console.warn("Aucun point de sauvegarde disponible pour le rollback.");
      return false;
    }

    console.log("🚨 TRANSACTION EN ÉCHEC ! Déclenchement du RollbackManager...");
    try {
      const backedSrc = path.join(this.backupPath, 'src');
      if (fs.existsSync(backedSrc)) {
        console.log("Restauration du dossier src...");
        // Supprimer le src cassé
        this._rmDirRecursive(CoreConfig.paths.src);
        // Remettre le backup
        this._copyDirRecursive(backedSrc, CoreConfig.paths.src);
      }

      const backedManifest = path.join(this.backupPath, 'manifest.json');
      if (fs.existsSync(backedManifest)) {
        console.log("Restauration du manifest.json...");
        fs.copyFileSync(backedManifest, CoreConfig.paths.manifest);
      }

      console.log("✓ Rollback terminé avec succès. Projet remis à l'état initial.");
      return true;
    } catch (err) {
      console.error("❌ Échec critique lors du Rollback :", err.message);
      return false;
    }
  }

  _copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach(childItemName => {
        this._copyDirRecursive(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  _rmDirRecursive(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const curPath = path.join(dirPath, file);
      if (fs.statSync(curPath).isDirectory()) {
        this._rmDirRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}

module.exports = UpdateEngine;
