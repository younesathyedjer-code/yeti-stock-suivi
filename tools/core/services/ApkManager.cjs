const { execSync } = require("child_process");


class ApkManager {


    constructor(config) {

        this.config = config;

    }



    execute(plan) {


        if (!plan.apkBuild) {

            console.log(
                "APK Release ignorée."
            );

            return false;

        }



        console.log(
            "\nAPK RELEASE BUILD"
        );



        execSync(
            "gradlew assembleRelease",
            {
                cwd:
                    this.config.androidPath,
                stdio:
                    "inherit"
            }
        );



        console.log(
            "\nAPK générée avec succès."
        );



        console.log(
            "Chemin : android/app/release/app-release.apk"
        );


        return true;


    }


}


module.exports = ApkManager;