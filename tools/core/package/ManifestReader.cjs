const fs = require("fs");
const path = require("path");

class ManifestReader {


    constructor(packagePath){

        this.packagePath = packagePath;

        this.manifest = null;

    }




    load(){


        const manifestFile =
            path.join(
                this.packagePath,
                "manifest.json"
            );


        if(!fs.existsSync(manifestFile)){

            throw new Error(
                "manifest.json introuvable."
            );

        }


        this.manifest =
            JSON.parse(

                fs.readFileSync(
                    manifestFile,
                    "utf8"
                )

            );


        this.manifest.build =
            Boolean(
                this.manifest.build
            );


        this.manifest.capacitorSync =
            Boolean(
                this.manifest.capacitorSync
            );


        this.manifest.apkBuild =
            Boolean(
                this.manifest.apkBuild
            );


        this.manifest.firebaseDeploy =
            Boolean(
                this.manifest.firebaseDeploy
            );


        this.manifest.gitCommit =
            Boolean(
                this.manifest.gitCommit
            );


        return this.manifest;


    }


}

module.exports = ManifestReader;