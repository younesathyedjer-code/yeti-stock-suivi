const fs = require('fs');
const CoreConfig = require('../config/CoreConfig.cjs');
const UpdatePlan = require('../models/UpdatePlan.cjs');

class PlanBuilder {
  static build() {
    const manifestPath = CoreConfig.paths.manifest;
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Le fichier manifest.json est introuvable à : ${manifestPath}`);
    }

    try {
      const rawData = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(rawData);
      return new UpdatePlan(manifest);
    } catch (err) {
      throw new Error(`Échec de lecture ou d'analyse du manifest.json : ${err.message}`);
    }
  }
}

module.exports = PlanBuilder;
