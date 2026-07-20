const BuildManager = require('./services/BuildManager.cjs');
const ApkManager = require('./services/ApkManager.cjs');
const GitManager = require('./services/GitManager.cjs');

class ReleaseManager {
  static async execute(plan, extractionReport = null) {
    console.log("================================ Release Manager ================================");
    
    // ==========================================
    // I. ÉTAPES CRITIQUES DE CONSTRUCTION
    // ==========================================
    console.log("\n--- [CONSTRUCTION CRITIQUE] ---");

    // 0. npm install si nécessaire
    try {
      BuildManager.runNpmInstallIfNeeded();
    } catch (err) {
      console.error("❌ Échec critique lors de l'installation des dépendances.");
      throw err;
    }

    // 1. Build Web React/Vite
    let buildSuccess = false;
    if (plan.build) {
      try {
        BuildManager.runWebBuild();
        buildSuccess = true;
      } catch (err) {
        console.error("❌ Échec critique lors du build web.");
        throw err; // Déclenchera le rollback
      }
    } else {
      console.log("Build Web : [IGNORÉ] selon manifest.json");
    }

    // 2. Capacitor Sync
    let capSyncSuccess = false;
    if (plan.capacitorSync) {
      try {
        BuildManager.runCapacitorSync();
        capSyncSuccess = true;
      } catch (err) {
        console.error("❌ Échec critique lors du Capacitor Sync.");
        throw err; // Déclenchera le rollback
      }
    } else {
      console.log("Capacitor Sync : [IGNORÉ] selon manifest.json");
    }

    // 3. Génération de l'APK Release
    let apkSuccess = false;
    if (plan.apkRelease) {
      try {
        ApkManager.generateReleaseApk();
        apkSuccess = true;
      } catch (err) {
        console.error("❌ Échec critique lors de la génération de l'APK Release.");
        throw err; // Déclenchera le rollback
      }
    } else {
      console.log("APK Release : [IGNORÉ] selon manifest.json");
    }

    // ==========================================
    // II. ÉTAPES OPTIONNELLES DE PUBLICATION
    // ==========================================
    console.log("\n--- [PUBLICATION OPTIONNELLE] ---");

    let firebaseWarning = null;
    let gitWarning = null;
    let gitStatusBefore = null;

    // 4. Firebase Deploy
    if (plan.firebaseDeploy) {
      try {
        BuildManager.runFirebaseDeploy();
      } catch (err) {
        firebaseWarning = err.message;
        console.warn("\n⚠️ AVERTISSEMENT : Le déploiement Firebase a échoué.");
        console.warn(`Détails de l'erreur : ${err.message}`);
        console.warn("Cette étape étant optionnelle, la mise à jour n'est pas annulée (pas de rollback).\n");
      }
    } else {
      console.log("Firebase Deploy : [IGNORÉ] (firebaseDeploy est à false dans manifest.json)");
    }

    // Get git status before staging/committing to check changes count
    if (plan.gitCommit) {
      gitStatusBefore = GitManager.getStatusInfo();
    }

    // 5. Git Commit and Push
    let gitSuccess = false;
    if (plan.gitCommit) {
      try {
        GitManager.commitAndPush(plan.version, plan.description);
        gitSuccess = true;
      } catch (err) {
        gitWarning = err.message;
        console.warn("\n⚠️ AVERTISSEMENT : La synchronisation Git / GitHub a échoué.");
        console.warn(`Détails de l'erreur : ${err.message}`);
        console.warn("Cette étape étant optionnelle, la mise à jour reste valide (pas de rollback).\n");
      }
    } else {
      console.log("Git Sync : [IGNORÉ] selon manifest.json");
    }

    const report = extractionReport || { detected: false };

    console.log("\n==============================");
    console.log("UPDATE TERMINÉ");
    console.log("==============\n");

    console.log("ZIP :");
    if (report.detected) {
      console.log("✓ Détecté");
      console.log("✓ Extrait");
      console.log("✓ Fichiers remplacés");
    } else {
      console.log("ℹ Ignoré (Aucun fichier ZIP détecté dans /updates)");
    }
    console.log("");

    console.log("Build Web :");
    if (plan.build) {
      console.log(buildSuccess ? "✓ Succès" : "❌ Échec");
    } else {
      console.log("ℹ Ignoré");
    }
    console.log("");

    console.log("Capacitor :");
    if (plan.capacitorSync) {
      console.log(capSyncSuccess ? "✓ Succès" : "❌ Échec");
    } else {
      console.log("ℹ Ignoré");
    }
    console.log("");

    console.log("APK :");
    if (plan.apkRelease) {
      if (apkSuccess) {
        console.log("✓ Généré");
        console.log("Chemin :");
        console.log("android/app/build/outputs/apk/release/app-release.apk");
      } else {
        console.log("❌ Échec");
      }
    } else {
      console.log("ℹ Ignoré");
    }
    console.log("");

    console.log("Git :");
    if (plan.gitCommit) {
      if (gitWarning) {
        console.log("❌ Échec");
      } else if (gitStatusBefore && !gitStatusBefore.hasChanges) {
        console.log("✓ Déjà à jour (aucun changement à commiter)");
      } else {
        console.log("✓ Commit créé");
        console.log("✓ Push GitHub effectué");
      }
    } else {
      console.log("ℹ Ignoré");
    }
    console.log("");

    console.log("Firebase :");
    if (plan.firebaseDeploy) {
      console.log(firebaseWarning ? "❌ Échec" : "✓ Déployé");
    } else {
      console.log("ℹ Ignoré");
    }
    console.log("\n==============================");
  }
}

module.exports = ReleaseManager;
