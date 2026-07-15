const { execSync } = require('child_process');
const CoreConfig = require('../config/CoreConfig.cjs');

class GitManager {
  static checkStatus() {
    try {
      const status = execSync('git status --porcelain', { cwd: CoreConfig.paths.root }).toString().trim();
      return status;
    } catch (err) {
      console.error("Erreur git status :", err.message);
      return '';
    }
  }

  static commitAndPush(version, description) {
    console.log("Début de l'intégration Git...");
    try {
      // Check if there are changes to commit
      const status = this.checkStatus();
      if (!status) {
        console.log("Aucune modification à commiter dans Git.");
        return true;
      }

      console.log("Ajout des modifications...");
      execSync(CoreConfig.commands.gitAdd, { cwd: CoreConfig.paths.root, stdio: 'inherit' });

      const commitMsg = CoreConfig.commands.gitCommit(version, description);
      console.log(`Création du commit : "${commitMsg}"...`);
      execSync(commitMsg, { cwd: CoreConfig.paths.root, stdio: 'inherit' });

      console.log("Envoi sur la branche main (git push)...");
      execSync(CoreConfig.commands.gitPush, { cwd: CoreConfig.paths.root, stdio: 'inherit' });

      console.log("✓ Synchronisation Git réussie !");
      return true;
    } catch (err) {
      console.error("❌ Échec de la synchronisation Git :", err.message);
      throw err;
    }
  }
}

module.exports = GitManager;
