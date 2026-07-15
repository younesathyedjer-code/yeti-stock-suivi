const BuildManager = require('./services/BuildManager.cjs');
const ApkManager = require('./services/ApkManager.cjs');
const GitManager = require('./services/GitManager.cjs');

class ReleaseManager {
  static async execute(plan) {
    console.log("================================ Release Manager ================================");
    
    // 1. Build Web React/Vite
    if (plan.build) {
      BuildManager.runWebBuild();
    } else {
      console.log("Build Web ignoré selon manifest.json.");
    }

    // 2. Capacitor Sync
    if (plan.capacitorSync) {
      BuildManager.runCapacitorSync();
    } else {
      console.log("Capacitor Sync ignoré selon manifest.json.");
    }

    // 3. Generation APK Release
    if (plan.apkRelease) {
      try {
        ApkManager.generateReleaseApk();
      } catch (err) {
        console.error("L'APK Release a échoué, mais poursuite de l'orchestration si configurée.");
        throw err;
      }
    } else {
      console.log("APK Release ignoré selon manifest.json.");
    }

    // 4. Firebase Deploy
    if (plan.firebaseDeploy) {
      BuildManager.runFirebaseDeploy();
    } else {
      console.log("Firebase Deploy ignoré selon manifest.json.");
    }

    // 5. Git Commit and Push
    if (plan.gitCommit) {
      GitManager.commitAndPush(plan.version, plan.description);
    } else {
      console.log("Git sync ignoré selon manifest.json.");
    }

    console.log("================================ Release Terminé ================================");
  }
}

module.exports = ReleaseManager;
