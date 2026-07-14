const { execSync } = require("child_process");


class BuildManager {


    constructor(config) {

        this.config = config;

    }



    run(command) {

        console.log("\n> " + command);


        execSync(
            command,
            {
                cwd: this.config.projectRoot,
                stdio: "inherit"
            }
        );

    }





    execute(plan) {


        console.log("\nBUILD MANAGER");



        if (plan.build) {


            console.log(
                "Build web demandé."
            );


            this.run(
                "npm run build"
            );


        }
        else {


            console.log(
                "Build web ignoré."
            );


        }





        if (plan.capacitorSync) {


            console.log(
                "Synchronisation Capacitor demandée."
            );


            this.run(
                "npx cap sync android"
            );


        }
        else {


            console.log(
                "Capacitor sync ignoré."
            );


        }





        if (plan.androidRelease) {


            console.log(
                "Generation APK Release demandée."
            );


            this.run(
                "android\\gradlew.bat assembleRelease"
            );


        }
        else {


            console.log(
                "APK Release ignorée."
            );


        }



        console.log(
            "\nBUILD MANAGER terminé."
        );


        return true;


    }


}


module.exports = BuildManager;