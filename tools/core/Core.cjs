const PlanBuilder = require('./planner/PlanBuilder.cjs');
const UpdateEngine = require('./UpdateEngine.cjs');
const ReleaseManager = require('./ReleaseManager.cjs');

class Core {
  static async run() {
    console.log("================================================================================");
    console.log("===================== INITIALISATION YETI UPDATE MANAGER v5 ====================");
    console.log("================================================================================");

    const engine = new UpdateEngine();
    
    try {
      // 0. Extraction de la mise à jour ZIP si présente
      console.log("Phase 0 : Recherche et extraction de mise à jour (.zip)...");
      engine.extractLatestZipIfExists();

      // 1. Lire le manifest et élaborer le plan
      console.log("\nPhase 1 : Lecture du manifest...");
      const plan = PlanBuilder.build();
      console.log(plan.summary());

      // 2. Lancer la sauvegarde de sécurité (sera ignorée si déjà effectuée lors de l'extraction ZIP)
      console.log("\nPhase 2 : Sauvegarde de sécurité...");
      engine.backup();

      // 3. Exécuter la transaction d'Update et de Release
      console.log("\nPhase 3 : Exécution de l'orchestration des tâches...");
      await ReleaseManager.execute(plan);

      console.log("\n================================================================================");
      console.log("========================= UPDATE TERMINÉ AVEC SUCCÈS ==========================");
      console.log("================================================================================");

    } catch (error) {
      console.error("\n❌ ERREUR CRITIQUE DURANT L'UPDATE :", error.message);
      
      // Rollback de sécurité en cas d'erreur de transaction
      try {
        engine.rollback();
      } catch (rollbackErr) {
        console.error("Échec lors du rollback de sécurité :", rollbackErr.message);
      }
      
      console.log("\n================================================================================");
      console.log("=========================== ÉCHEC DE L'UPDATE (ANNULÉ) =========================");
      console.log("================================================================================");
      process.exit(1);
    }
  }
}

module.exports = Core;
