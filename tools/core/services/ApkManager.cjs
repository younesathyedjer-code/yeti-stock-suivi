const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const CoreConfig = require('../config/CoreConfig.cjs');

class ApkManager {
  static generateReleaseApk() {
    console.log("Exécution de la génération de l'APK Release...");
    const androidDir = CoreConfig.paths.android;

    if (!fs.existsSync(androidDir)) {
      throw new Error("Dossier /android introuvable. Impossible de générer l'APK.");
    }

    // On Windows or Unix, use appropriate gradlew wrapper
    const isWindows = process.platform === 'win32';
    const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';
    const assembleCmd = `${gradlewCmd} assembleRelease`;

    try {
      // If unix, ensure gradlew has execution rights
      if (!isWindows) {
        try {
          execSync('chmod +x gradlew', { cwd: androidDir, stdio: 'ignore' });
        } catch (_) {}
      }

      console.log(`Exécution de la commande Gradle : ${assembleCmd}`);
      execSync(assembleCmd, { cwd: androidDir, stdio: 'inherit' });

      // Search for generated APKs
      const apkSubDir = path.join(androidDir, 'app/build/outputs/apk/release');
      console.log(`✓ APK généré avec succès ! Recherche dans ${apkSubDir}...`);

      if (fs.existsSync(apkSubDir)) {
        const files = fs.readdirSync(apkSubDir);
        const apkFiles = files.filter(f => f.endsWith('.apk'));
        if (apkFiles.length > 0) {
          console.log("APKs Release trouvés :");
          apkFiles.forEach(f => console.log(` - ${f} (${path.join(apkSubDir, f)})`));
        } else {
          console.log("Aucun fichier .apk trouvé dans le dossier de build de release Gradle.");
        }
      }
      return true;
    } catch (err) {
      console.error("❌ Échec de la génération de l'APK Release :", err.message);
      throw err;
    }
  }
}

module.exports = ApkManager;
