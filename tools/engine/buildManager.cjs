const { execSync } = require("child_process");

class BuildManager {


    constructor(config, manifest){

        this.config = config;
        this.manifest = manifest;

    }



    run(command){

        console.log(
            "\n> " + command
        );


        execSync(
            command,
            {
                cwd:this.config.projectRoot,
                stdio:"inherit"
            }
        );

    }





    build(){


        console.log(
            "\nBUILD MANAGER"
        );



        if(
            this.manifest &&
            this.manifest.build === true
        ){


            console.log(
                "Build web demandé."
            );


            this.run(
                "npm run build"
            );


        }
        else{


            console.log(
                "Build web ignoré."
            );


        }





        if(
            this.manifest &&
            this.manifest.capacitorSync === true
        ){


            console.log(
                "Synchronisation Capacitor demandée."
            );


            this.run(
                "npx cap sync android"
            );


        }
        else{


            console.log(
                "Capacitor sync ignoré."
            );


        }





        if(
            this.manifest &&
            this.manifest.androidRelease === true
        ){


            console.log(
                "Generation APK Release demandée."
            );


            this.run(
                "android\\gradlew.bat assembleRelease"
            );


        }
        else{


            console.log(
                "APK Release ignorée."
            );


        }





        if(
            this.manifest &&
            this.manifest.firebaseDeploy === true
        ){


            console.log(
                "Firebase deploy demandé."
            );


            console.log(
                "Géré par GitHub Actions."
            );


        }




        console.log(
            "\nBUILD MANAGER terminé."
        );


    }


}


module.exports = BuildManager;