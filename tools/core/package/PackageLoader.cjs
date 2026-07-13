const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

class PackageLoader {

    constructor(config) {
        this.config = config;
    }

    findLatestZip() {

        const files =
            fs.readdirSync(this.config.iaFolder)
            .filter(f => f.endsWith(".zip"));

        if (!files.length)
            throw new Error("Aucun ZIP trouvé.");

        return path.join(
            this.config.iaFolder,
            files[files.length - 1]
        );

    }

    extract(zipFile) {

        if (fs.existsSync(this.config.tempFolder)) {

            fs.rmSync(
                this.config.tempFolder,
                {
                    recursive: true,
                    force: true
                }
            );

        }

        fs.mkdirSync(
            this.config.tempFolder,
            { recursive: true }
        );

        const zip = new AdmZip(zipFile);

        zip.extractAllTo(
            this.config.tempFolder,
            true
        );

        return this.config.tempFolder;

    }

}

module.exports = PackageLoader;