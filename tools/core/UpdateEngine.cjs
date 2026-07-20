const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const CoreConfig = require('./config/CoreConfig.cjs');

class UpdateEngine {
  constructor() {
    this.backupPath = null;
    this.extractionReport = {
      detected: false,
      extracted: false,
      replacedCount: 0,
      addedCount: 0,
      deletedCount: 0,
      rootReplacedCount: 0
    };
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

      // Trouver le dossier racine de la mise à jour (peut être imbriqué d'un niveau)
      let tempSourceDir = tempPath;
      let srcSource = path.join(tempPath, 'src');

      if (!fs.existsSync(srcSource)) {
        const subdirs = fs.readdirSync(tempPath).filter(f => fs.statSync(path.join(tempPath, f)).isDirectory());
        if (subdirs.length === 1) {
          const nestedPath = path.join(tempPath, subdirs[0]);
          if (fs.existsSync(path.join(nestedPath, 'src'))) {
            tempSourceDir = nestedPath;
            srcSource = path.join(nestedPath, 'src');
          }
        }
      }

      if (!fs.existsSync(srcSource)) {
        throw new Error("Le package ZIP ne contient pas de dossier 'src' valide à sa racine.");
      }

      // Calculer les différences pour le dossier src/ avant de le remplacer !
      const localSrc = CoreConfig.paths.src;
      const currentFiles = this._getAllFilesRelative(localSrc);
      const newFiles = this._getAllFilesRelative(srcSource);
      
      const replaced = [];
      const added = [];
      const deleted = [];
      
      newFiles.forEach(f => {
        if (currentFiles.includes(f)) {
          replaced.push(f);
        } else {
          added.push(f);
        }
      });
      
      currentFiles.forEach(f => {
        if (!newFiles.includes(f)) {
          deleted.push(f);
        }
      });

      console.log("Application de la nouvelle mise à jour...");

      // Parcourir tous les éléments à la racine de l'archive (tempSourceDir)
      const items = fs.readdirSync(tempSourceDir);
      const ignoredNames = ['.git', 'node_modules', '.yeti_backups', 'updates'];

      let rootReplacedCount = 0;

      items.forEach(itemName => {
        if (ignoredNames.includes(itemName)) return;

        const sourceItemPath = path.join(tempSourceDir, itemName);
        const destItemPath = path.join(CoreConfig.paths.root, itemName);

        if (fs.existsSync(destItemPath)) {
          // Si c'est un dossier, on le supprime d'abord récursivement, puis on copie le nouveau
          if (fs.statSync(destItemPath).isDirectory()) {
            this._rmDirRecursive(destItemPath);
            this._copyDirRecursive(sourceItemPath, destItemPath);
          } else {
            // C'est un fichier, on l'écrase
            fs.copyFileSync(sourceItemPath, destItemPath);
            rootReplacedCount++;
          }
        } else {
          // Nouveau fichier ou dossier
          if (fs.statSync(sourceItemPath).isDirectory()) {
            this._copyDirRecursive(sourceItemPath, destItemPath);
          } else {
            fs.copyFileSync(sourceItemPath, destItemPath);
          }
        }
      });

      // Vérification post-extraction : s'assurer que les fichiers critiques sont présents
      if (!fs.existsSync(path.join(CoreConfig.paths.src, 'App.tsx')) || !fs.existsSync(CoreConfig.paths.manifest)) {
        throw new Error("Vérification post-extraction échouée : les fichiers critiques (src/App.tsx ou manifest.json) sont absents.");
      }

      console.log("✓ Remplacement des fichiers terminé avec succès.");

      // Stocker les détails du rapport d'extraction
      this.extractionReport = {
        detected: true,
        extracted: true,
        replacedCount: replaced.length,
        addedCount: added.length,
        deletedCount: deleted.length,
        rootReplacedCount
      };

      // Afficher le rapport d'extraction
      console.log("\n================================================================================");
      console.log("=================== RAPPORT D'EXTRACTION ET REMPLACEMENT =======================");
      console.log("================================================================================");
      console.log(`- Fichiers de code (/src) remplacés   : ${replaced.length}`);
      console.log(`- Nouveaux fichiers (/src) ajoutés     : ${added.length}`);
      console.log(`- Fichiers (/src) supprimés            : ${deleted.length}`);
      if (deleted.length > 0) {
        console.log("Fichiers supprimés :");
        deleted.forEach(f => console.log(`   - src/${f}`));
      }
      if (rootReplacedCount > 0) {
        console.log(`- Fichiers de configuration racine écrasés : ${rootReplacedCount}`);
      }
      console.log("================================================================================\n");

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
      
      // 1. Sauvegarde du dossier src/
      if (fs.existsSync(CoreConfig.paths.src)) {
        this._copyDirRecursive(CoreConfig.paths.src, path.join(this.backupPath, 'src'));
      }
      
      // 2. Sauvegarde des fichiers clés de la racine si présents
      const filesToBackup = ['manifest.json', 'package.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'server.ts'];
      filesToBackup.forEach(file => {
        const localFile = path.join(CoreConfig.paths.root, file);
        if (fs.existsSync(localFile)) {
          fs.copyFileSync(localFile, path.join(this.backupPath, file));
        }
      });

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
      // 1. Restaurer le dossier src/
      const backedSrc = path.join(this.backupPath, 'src');
      if (fs.existsSync(backedSrc)) {
        console.log("Restauration du dossier src...");
        if (fs.existsSync(CoreConfig.paths.src)) {
          this._rmDirRecursive(CoreConfig.paths.src);
        }
        this._copyDirRecursive(backedSrc, CoreConfig.paths.src);
      }

      // 2. Restaurer les fichiers de configuration racine
      const filesToRestore = ['manifest.json', 'package.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'server.ts'];
      filesToRestore.forEach(file => {
        const backedFile = path.join(this.backupPath, file);
        const localFile = path.join(CoreConfig.paths.root, file);
        if (fs.existsSync(backedFile)) {
          console.log(`Restauration de ${file}...`);
          fs.copyFileSync(backedFile, localFile);
        } else if (fs.existsSync(localFile)) {
          console.log(`Suppression de ${file} (car absent de la sauvegarde d'origine)...`);
          fs.unlinkSync(localFile);
        }
      });

      console.log("✓ Rollback terminé avec succès. Projet remis à l'état initial.");
      return true;
    } catch (err) {
      console.error("❌ Échec critique lors du Rollback :", err.message);
      return false;
    }
  }

  // Helper pour lister les fichiers récursivement
  _getAllFilesRelative(dir, baseDir = dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this._getAllFilesRelative(filePath, baseDir));
      } else {
        results.push(path.relative(baseDir, filePath));
      }
    });
    return results;
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
