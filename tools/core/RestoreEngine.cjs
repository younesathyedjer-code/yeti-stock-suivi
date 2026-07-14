const fs = require("fs");
const path = require("path");

class RestoreEngine {

    constructor(config, restoreManager) {

        this.config = config;
        this.restoreManager = restoreManager;

    }

    latestBackup() {

        const backups = fs.readdirSync(this.config.backupFolder)
            .filter(f => fs.statSync(path.join(this.config.backupFolder, f)).isDirectory())
            .sort();

        if (backups.length === 0)
            throw new Error("Aucune sauvegarde disponible.");

        return path.join(
            this.config.backupFolder,
            backups[backups.length - 1]
        );

    }

    restore() {

        const backup = this.latestBackup();

        this.restoreManager.restore(
            backup
        );

        return backup;

    }

}

module.exports = RestoreEngine;