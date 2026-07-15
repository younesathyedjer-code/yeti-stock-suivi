const { execSync } = require("child_process");
const path = require("path");


class BuildManager {


    constructor(config){

        this.config = config;

    }



    run(command, cwd = this.config.projectRoot){


        console.log("\n> " + command);


        execSync(

            command,

            {

                cwd,

                stdio:"inherit"

            }

        );


    }





    execute(plan){


        console.log("\nBUILD MANAGER");



        if(plan.build){


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





        if(plan.capacitorSync){


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





        if(plan.apkBuild){


            console.log(
                "Construction APK Release demandée."
            );


            const androidPath =
                path.join(

                    this.config.projectRoot,

                    "android"

                );



            if(process.platform === "win32"){


                this.run(

                    "gradlew.bat assembleRelease",

                    androidPath

                );


            }

            else{


                this.run(

                    "./gradlew assembleRelease",

                    androidPath

                );


            }



            console.log(
                "APK Release générée."
            );


        }

        else{


            console.log(
                "APK Release ignorée."
            );


        }




        if(plan.firebaseDeploy){


            console.log(
                "Firebase Deploy demandé."
            );


        }



        console.log(
            "\nBUILD MANAGER terminé."
        );


    }


}


module.exports = BuildManager;