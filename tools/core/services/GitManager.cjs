const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const CoreConfig = require('../config/CoreConfig.cjs');

class GitManager {
  static getStatusInfo() {
    try {
      // Get all changes in the entire repository (which automatically respects .gitignore)
      const statusOutput = execSync('git status --porcelain', { cwd: CoreConfig.paths.root }).toString();
      const lines = statusOutput.split('\n').map(l => l.trim()).filter(Boolean);
      
      let modified = 0;
      let added = 0;
      let deleted = 0;
      
      lines.forEach(line => {
        const code = line.substring(0, 2);
        if (code.includes('M') || code.includes('R')) {
          modified++;
        } else if (code.includes('?') || code.includes('A')) {
          added++;
        } else if (code.includes('D')) {
          deleted++;
        }
      });
      
      return {
        hasChanges: lines.length > 0,
        modified,
        added,
        deleted,
        lines
      };
    } catch (err) {
      console.error("Erreur lors de la lecture du statut Git :", err.message);
      return { hasChanges: false, modified: 0, added: 0, deleted: 0, lines: [] };
    }
  }

  static checkStatus() {
    const statusInfo = this.getStatusInfo();
    if (!statusInfo.hasChanges) return '';
    return statusInfo.lines.join('\n');
  }

  static commitAndPush(version, description, backupPath = null) {
    console.log("Début de l'intégration Git...");
    try {
      // 1. Désindexer préventivement les dossiers locaux qui ne doivent jamais être suivis par Git
      console.log("Nettoyage de l'index Git pour s'assurer que les sauvegardes restent locales...");
      try {
        execSync('git rm -r --cached .yeti_backups --ignore-unmatch', { cwd: CoreConfig.paths.root, stdio: 'ignore' });
        execSync('git rm -r --cached updates --ignore-unmatch', { cwd: CoreConfig.paths.root, stdio: 'ignore' });
      } catch (rmErr) {
        // Ignorer les erreurs si les fichiers ne sont pas indexés
      }

      // Check if there are changes to commit
      const statusInfo = this.getStatusInfo();
      
      // Récupérer les dépendances modifiées
      let modifiedDeps = [];
      if (backupPath && fs.existsSync(backupPath)) {
        const backupPkgPath = path.join(backupPath, 'package.json');
        const currentPkgPath = path.join(CoreConfig.paths.root, 'package.json');
        if (fs.existsSync(backupPkgPath) && fs.existsSync(currentPkgPath)) {
          try {
            const oldPkg = JSON.parse(fs.readFileSync(backupPkgPath, 'utf8'));
            const newPkg = JSON.parse(fs.readFileSync(currentPkgPath, 'utf8'));
            
            const oldDeps = { ...(oldPkg.dependencies || {}), ...(oldPkg.devDependencies || {}) };
            const newDeps = { ...(newPkg.dependencies || {}), ...(newPkg.devDependencies || {}) };
            
            Object.keys(newDeps).forEach(dep => {
              if (!oldDeps[dep]) {
                modifiedDeps.push(`+ ${dep} (${newDeps[dep]})`);
              } else if (oldDeps[dep] !== newDeps[dep]) {
                modifiedDeps.push(`~ ${dep} (${oldDeps[dep]} -> ${newDeps[dep]})`);
              }
            });
            Object.keys(oldDeps).forEach(dep => {
              if (!newDeps[dep]) {
                modifiedDeps.push(`- ${dep} (supprimé)`);
              }
            });
          } catch (err) {
            // Ignorer l'erreur silencieusement
          }
        }
      }

      console.log("\n=== RÉSUMÉ DES MODIFICATIONS ===");
      console.log(`Fichiers modifiés : ${statusInfo.modified}`);
      console.log(`Nouveaux fichiers : ${statusInfo.added}`);
      console.log(`Fichiers supprimés : ${statusInfo.deleted}`);
      if (modifiedDeps.length > 0) {
        console.log("Dépendances modifiées :");
        modifiedDeps.forEach(dep => console.log(`   ${dep}`));
      } else {
        console.log("Dépendances modifiées : Aucune");
      }
      console.log("===============================\n");

      // Validation de sécurité absolue : si des fichiers critiques ont disparu, on bloque le commit !
      const criticalFiles = [
        'package.json',
        'manifest.json',
        'vite.config.ts',
        'src/App.tsx'
      ];
      
      let missingCritical = [];
      criticalFiles.forEach(file => {
        if (!fs.existsSync(path.join(CoreConfig.paths.root, file))) {
          missingCritical.push(file);
        }
      });

      if (missingCritical.length > 0) {
        console.error("❌ ERREUR DE SÉCURITÉ GIT : Des fichiers critiques indispensables ont disparu !");
        missingCritical.forEach(file => console.error(`  - Fichier manquant : ${file}`));
        throw new Error(`Commit bloqué : Fichiers critiques manquants : ${missingCritical.join(', ')}`);
      }

      if (!statusInfo.hasChanges) {
        console.log("Aucune modification à commiter dans Git.");
        return true;
      }

      console.log("\nAjout de toutes les modifications (git add .)...");
      execSync('git add .', { cwd: CoreConfig.paths.root, stdio: 'inherit' });

      // Create commit message: "Update Yeti Stock v[version]"
      const commitMsg = `Update Yeti Stock v${version}`;
      console.log(`Création du commit : "${commitMsg}"...`);
      
      // Escape commit message quotes to prevent shell issues
      const escapedMsg = commitMsg.replace(/"/g, '\\"');
      execSync(`git commit -m "${escapedMsg}"`, { cwd: CoreConfig.paths.root, stdio: 'inherit' });

      console.log("Envoi sur la branche main (git push)...");
      execSync('git push origin main', { cwd: CoreConfig.paths.root, stdio: 'inherit' });

      console.log("✓ Synchronisation Git réussie !");
      return true;
    } catch (err) {
      console.error("❌ Échec de la synchronisation Git :", err.message);
      throw err;
    }
  }
}

module.exports = GitManager;
