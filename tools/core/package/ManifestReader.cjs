const fs = require("fs");
const path = require("path");


class ManifestReader {


    constructor(packagePath) {

        this.packagePath = packagePath;
        this.manifest = null;

    }



    load() {


        const file =
            path.join(
                this.packagePath,
                "manifest.json"
            );


        if (!fs.existsSync(file)) {

            throw new Error(
                "manifest.json introuvable."
            );

        }



        this.manifest =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );


        return this.manifest;


    }




    getVersion() {

        return this.manifest?.version || null;

    }




    getDescription() {

        return this.manifest?.description || "";

    }




    getOptions() {


        return {


            build:
                this.manifest?.build || false,


            capacitorSync:
                this.manifest?.capacitorSync || false,


            apkBuild:
                this.manifest?.apkBuild || false,


            firebaseDeploy:
                this.manifest?.firebaseDeploy || false,


            gitCommit:
                this.manifest?.gitCommit || false


        };


    }


}


module.exports = ManifestReader;