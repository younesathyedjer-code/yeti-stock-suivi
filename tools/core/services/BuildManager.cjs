const { execSync } = require('child_process');
const CoreConfig = require('../config/CoreConfig.cjs');

class BuildManager {
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
    try {
      execSync(CoreConfig.commands.capSync, { cwd: CoreConfig.paths.root, stdio: 'inherit' });
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
