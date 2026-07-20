const fs = require('fs');
const path = require('path');
const CoreConfig = require('./config/CoreConfig.cjs');

async function runRollback() {
  console.log("================================================================================");
  console.log("==================== LANCEUR DE ROLLBACK AUTOMATIQUE YETI ====================");
  console.log("================================================================================");

  const backupDir = CoreConfig.paths.backup;
  if (!fs.existsSync(backupDir)) {
    console.error("❌ Aucun dossier de sauvegarde (.yeti_backups) trouvé.");
    process.exit(1);
  }

  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup_'))
    .map(f => {
      const timestamp = parseInt(f.replace('backup_', ''));
      return {
        folder: f,
        path: path.join(backupDir, f),
        date: new Date(timestamp)
      };
    })
    .sort((a, b) => b.date - a.date); // Most recent first

  if (backups.length === 0) {
    console.error("❌ Aucune sauvegarde trouvée dans .yeti_backups.");
    process.exit(1);
  }

  console.log("Sauvegardes locales disponibles (de la plus récente à la plus ancienne) :");
  backups.forEach((b, idx) => {
    console.log(` [${idx}] ${b.folder} (${b.date.toLocaleString('fr-FR')})`);
  });

  // By default, rollback to the most recent backup [0]
  const targetBackup = backups[0];
  console.log(`\nRestauration automatique vers la sauvegarde la plus récente : ${targetBackup.folder}`);

  try {
    // Helper to remove directory recursively
    const rmDirRecursive = (dirPath) => {
      if (!fs.existsSync(dirPath)) return;
      fs.readdirSync(dirPath).forEach(file => {
        const curPath = path.join(dirPath, file);
        if (fs.statSync(curPath).isDirectory()) {
          rmDirRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(dirPath);
    };

    // Helper to copy directory recursively
    const copyDirRecursive = (src, dest) => {
      if (!fs.existsSync(src)) return;
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => {
          copyDirRecursive(path.join(src, child), path.join(dest, child));
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    };

    // 1. Restaurer src/
    const backedSrc = path.join(targetBackup.path, 'src');
    if (fs.existsSync(backedSrc)) {
      console.log("Restauration du dossier /src...");
      rmDirRecursive(CoreConfig.paths.src);
      copyDirRecursive(backedSrc, CoreConfig.paths.src);
    }

    // 2. Restaurer manifest.json
    const backedManifest = path.join(targetBackup.path, 'manifest.json');
    if (fs.existsSync(backedManifest)) {
      console.log("Restauration du fichier manifest.json...");
      fs.copyFileSync(backedManifest, CoreConfig.paths.manifest);
    }

    console.log("\n✓ Restauration locale du code source réussie !");
    console.log("🚀 Lancement automatique de la reconstruction et de la synchronisation...");

    // Lire le manifest restauré et générer le plan
    const PlanBuilder = require('./planner/PlanBuilder.cjs');
    const ReleaseManager = require('./ReleaseManager.cjs');
    
    const plan = PlanBuilder.build();
    console.log(plan.summary());

    // Exécuter l'orchestration des tâches (build web, capacitor, apk, git sync...)
    await ReleaseManager.execute(plan);

    console.log("\n================================================================================");
    console.log("========================= ROLLBACK TERMINÉ AVEC SUCCÈS ==========================");
    console.log("================================================================================");
  } catch (err) {
    console.error("❌ Échec de la restauration ou de la reconstruction :", err.message);
    process.exit(1);
  }
}

runRollback().catch(err => {
  console.error("❌ Erreur non gérée lors du rollback :", err);
  process.exit(1);
});

