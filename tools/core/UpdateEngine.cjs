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

      // Calculer les différences pour le dossier src/ avant d'appliquer le patch !
      const localSrc = CoreConfig.paths.src;
      const currentFiles = this._getAllFilesRelative(localSrc);
      const newFiles = this._getAllFilesRelative(srcSource);
      
      const replaced = [];
      const added = [];
      const preserved = [];
      
      newFiles.forEach(f => {
        if (currentFiles.includes(f)) {
          replaced.push(f);
        } else {
          added.push(f);
        }
      });
      
      currentFiles.forEach(f => {
        if (!newFiles.includes(f)) {
          preserved.push(f);
        }
      });

      console.log("Application de la mise à jour sous forme de patch (fusion)...");

      // Parcourir tous les éléments à la racine de l'archive (tempSourceDir)
      const items = fs.readdirSync(tempSourceDir);
      const ignoredNames = ['.git', 'node_modules', '.yeti_backups', 'updates'];

      let rootReplacedCount = 0;

      items.forEach(itemName => {
        if (ignoredNames.includes(itemName)) return;

        const sourceItemPath = path.join(tempSourceDir, itemName);
        const destItemPath = path.join(CoreConfig.paths.root, itemName);

        if (fs.existsSync(destItemPath)) {
          if (fs.statSync(destItemPath).isDirectory()) {
            // Fusionner récursivement au lieu de tout supprimer !
            this._mergeDirRecursive(sourceItemPath, destItemPath);
          } else {
            if (itemName === 'package.json') {
              // Fusionner de façon intelligente package.json sans casser les dépendances critiques
              this._mergePackageJson(destItemPath, sourceItemPath);
            } else {
              // C'est un fichier, on l'écrase
              fs.copyFileSync(sourceItemPath, destItemPath);
              rootReplacedCount++;
            }
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

      console.log("✓ Application du patch terminée avec succès.");

      // Stocker les détails du rapport d'extraction
      this.extractionReport = {
        detected: true,
        extracted: true,
        replacedCount: replaced.length,
        addedCount: added.length,
        deletedCount: 0, // Nous ne supprimons plus aucun fichier !
        rootReplacedCount
      };

      // Afficher le rapport d'extraction de type Patch
      console.log("\n================================================================================");
      console.log("=================== RAPPORT D'APPLICATION DU PATCH YETI ========================");
      console.log("================================================================================");
      console.log(`- Fichiers de code (/src) mis à jour/remplacés : ${replaced.length}`);
      console.log(`- Nouveaux fichiers (/src) ajoutés             : ${added.length}`);
      console.log(`- Fichiers (/src) existants préservés          : ${preserved.length}`);
      if (preserved.length > 0) {
        console.log("Fichiers d'origine conservés intacts (absents de la mise à jour) :");
        preserved.slice(0, 15).forEach(f => console.log(`   - src/${f}`));
        if (preserved.length > 15) {
          console.log(`   ... et ${preserved.length - 15} autres fichiers conservés.`);
        }
      }
      if (rootReplacedCount > 0) {
        console.log(`- Fichiers de configuration racine écrasés      : ${rootReplacedCount}`);
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

  _mergeDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const items = fs.readdirSync(src);
    items.forEach(item => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      if (fs.statSync(srcPath).isDirectory()) {
        this._mergeDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  _mergePackageJson(currentPath, newPath) {
    if (!fs.existsSync(currentPath)) {
      fs.copyFileSync(newPath, currentPath);
      return;
    }
    try {
      const currentPkg = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
      const newPkg = JSON.parse(fs.readFileSync(newPath, 'utf8'));

      // Fusionner les scripts de façon non destructive
      const mergedScripts = { ...(currentPkg.scripts || {}), ...(newPkg.scripts || {}) };

      // Fusionner les dépendances en préservant tout ce qui existe
      const currentDeps = currentPkg.dependencies || {};
      const newDeps = newPkg.dependencies || {};
      const mergedDeps = { ...currentDeps, ...newDeps };

      // Sécurité : S'assurer de conserver les packages critiques existants
      const criticalPackages = [
        'react', 'react-dom', 'vite', 'firebase', 
        '@capacitor/core', '@capacitor/cli', '@capacitor/android'
      ];
      criticalPackages.forEach(pkg => {
        if (currentDeps[pkg] && !mergedDeps[pkg]) {
          mergedDeps[pkg] = currentDeps[pkg];
        }
      });

      // Fusionner les devDependencies
      const currentDevDeps = currentPkg.devDependencies || {};
      const newDevDeps = newPkg.devDependencies || {};
      const mergedDevDeps = { ...currentDevDeps, ...newDevDeps };
      criticalPackages.forEach(pkg => {
        if (currentDevDeps[pkg] && !mergedDevDeps[pkg]) {
          mergedDevDeps[pkg] = currentDevDeps[pkg];
        }
      });

      const mergedPkg = {
        ...currentPkg,
        ...newPkg,
        scripts: mergedScripts,
        dependencies: mergedDeps,
        devDependencies: mergedDevDeps
      };

      fs.writeFileSync(currentPath, JSON.stringify(mergedPkg, null, 2), 'utf8');
      console.log("✓ package.json fusionné avec succès (dépendances préservées) !");
    } catch (err) {
      console.warn("⚠️ Impossible de fusionner package.json de façon intelligente, écrasement par défaut :", err.message);
      fs.copyFileSync(newPath, currentPath);
    }
  }

  validateProject() {
    const rootDir = CoreConfig.paths.root;
    const pkgPath = path.join(rootDir, 'package.json');
    const srcDir = CoreConfig.paths.src;

    const performValidation = () => {
      let isPackageJsonValid = false;
      let pkg = null;
      try {
        if (fs.existsSync(pkgPath)) {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          isPackageJsonValid = true;
        }
      } catch (err) {}

      if (!isPackageJsonValid) {
        return { success: false, reason: "package_json_invalid", details: "package.json manquant ou malformé" };
      }

      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {})
      };

      // Définir les packages importants et critiques
      const baseCritical = ['react', 'react-dom', 'vite'];
      const optionalCritical = ['firebase', '@capacitor/core'];
      const criticalToCheck = [...baseCritical];

      optionalCritical.forEach(pkgName => {
        if (allDeps[pkgName]) {
          criticalToCheck.push(pkgName);
        }
      });

      // 1 & 2. Vérifier chaque package critique / important
      const criticalStatus = [];
      let allCriticalOk = true;

      criticalToCheck.forEach(pkgName => {
        let physicalExists = false;
        
        // Vérification physique du dossier dans node_modules
        const pkgDir = path.join(rootDir, 'node_modules', pkgName);
        if (fs.existsSync(pkgDir) && fs.statSync(pkgDir).isDirectory()) {
          physicalExists = true;
        } else {
          // Fallback par require.resolve
          try {
            require.resolve(pkgName, { paths: [rootDir] });
            physicalExists = true;
          } catch (e) {}
        }

        if (physicalExists) {
          criticalStatus.push({ name: pkgName, ok: true, msg: `✔ ${pkgName} disponible dans node_modules` });
        } else {
          allCriticalOk = false;
          criticalStatus.push({ name: pkgName, ok: false, msg: `❌ ${pkgName} absent ou corrompu dans node_modules` });
        }
      });

      // 3. Scanner les imports et tester leur résolvabilité physique réelle
      if (!fs.existsSync(srcDir)) {
        return { success: false, reason: "src_missing", details: "Dossier src/ manquant" };
      }

      const tsFiles = this._getAllFilesRelative(srcDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      const importIssues = [];

      const ignorePackages = new Set([
        'path', 'fs', 'child_process', 'crypto', 'os', 'http', 'https', 'url', 'querystring', 'util', 'stream', 'zlib', 'events'
      ]);

      tsFiles.forEach(file => {
        const filePath = path.join(srcDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Regex robuste pour intercepter les imports classiques, multiples et side-effects
          const importRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
          let match;
          while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.')) continue;
            if (importPath.startsWith('/')) continue;

            let pkgName = importPath;
            if (importPath.startsWith('@')) {
              const parts = importPath.split('/');
              pkgName = parts.slice(0, 2).join('/');
            } else {
              pkgName = importPath.split('/')[0];
            }

            if (ignorePackages.has(pkgName)) continue;

            // Vérifier si déclaré dans package.json
            const isDeclared = !!allDeps[pkgName];
            
            // Vérification physique de l'import exact
            let isPhysicalInstalled = false;
            const pkgDir = path.join(rootDir, 'node_modules', pkgName);
            if (fs.existsSync(pkgDir) && fs.statSync(pkgDir).isDirectory()) {
              isPhysicalInstalled = true;
            } else {
              try {
                require.resolve(importPath, { paths: [rootDir] });
                isPhysicalInstalled = true;
              } catch (e) {
                try {
                  require.resolve(pkgName, { paths: [rootDir] });
                  isPhysicalInstalled = true;
                } catch (e2) {}
              }
            }

            if (!isDeclared || !isPhysicalInstalled) {
              importIssues.push({
                importPath,
                pkgName,
                file: `src/${file}`,
                isDeclared,
                isPhysicalInstalled
              });
            }
          }
        } catch (err) {
          // Ignorer silencieusement les erreurs de lecture
        }
      });

      const success = allCriticalOk && (importIssues.length === 0);

      return {
        success,
        criticalStatus,
        importIssues
      };
    };

    console.log("\n=== VALIDATION DU PROJET ===");
    let res = performValidation();

    // Si échec du premier coup, on tente une restauration/installation automatique
    if (!res.success) {
      console.log("\nℹ Dépendance(s) manquante(s) ou non installée(s) physiquement dans node_modules.");
      console.log("Exécution automatique de 'npm install' pour rétablir les modules...");
      try {
        execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
        console.log("✓ npm install exécuté avec succès. Seconde validation du projet...\n");
        res = performValidation();
      } catch (err) {
        console.error("❌ Impossible de restaurer les dépendances automatiquement via npm install :", err.message);
      }
    }

    // Affichage des logs finaux
    console.log("\n=== RÉSULTAT DE LA VALIDATION ===");
    console.log("✔ package.json valide");
    
    if (res.criticalStatus) {
      res.criticalStatus.forEach(status => {
        console.log(status.msg);
      });
    }

    if (res.success) {
      console.log("✔ Tous les imports du code source correspondent à des dépendances déclarées et installées");
      console.log("=============================\n");
      return true;
    } else {
      console.error("❌ ERREUR DE VALIDATION : Le projet présente des anomalies critiques.");
      
      if (res.importIssues && res.importIssues.length > 0) {
        const firstIssue = res.importIssues[0];
        console.error("\n=============================");
        console.error("🚨 UPDATE ANNULÉ !");
        console.error(`\nDépendance manquante :\n${firstIssue.importPath}`);
        console.error(`\nFichier concerné :\n${firstIssue.file}`);
        if (!firstIssue.isDeclared) {
          console.error(`\n(La dépendance "${firstIssue.pkgName}" n'est pas déclarée dans package.json)`);
        } else if (!firstIssue.isPhysicalInstalled) {
          console.error(`\n(La dépendance "${firstIssue.pkgName}" est déclarée dans package.json mais absente physiquement de node_modules)`);
        }
        console.error("=============================");
      } else {
        console.error("\n=============================");
        console.error("🚨 UPDATE ANNULÉ : Des dépendances critiques (React, Vite, etc.) sont absentes de node_modules.");
        console.error("=============================");
      }
      
      console.error("\nAucun build lancé.");
      console.error("Aucun commit Git effectué.");
      console.log("=============================\n");
      return false;
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
