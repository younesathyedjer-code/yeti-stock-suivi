const { execSync } = require("child_process");



class GitManager {



    constructor(config, manifest){


        this.config = config;

        this.manifest = manifest;


    }






    run(command){


        return execSync(
            command,
            {
                cwd:this.config.projectRoot,
                encoding:"utf8"
            }
        ).trim();


    }







    commitAndPush(){



        console.log(
            "\nGIT MANAGER"
        );



        const status =
            this.run(
                "git status --porcelain"
            );



        if(!status){


            console.log(
                "Aucun changement Git."
            );


            return;


        }






        console.log(
            "Ajout des fichiers..."
        );



        this.run(
            "git add ."
        );





        let message =
            "Automatic update";



        if(this.manifest){


            message =
                "Update " +
                (
                    this.manifest.version ||
                    ""
                )
                +
                " - "
                +
                (
                    this.manifest.description ||
                    ""
                );


        }





        console.log(
            "Commit :",
            message
        );



        this.run(
            `git commit -m "${message}"`
        );





        console.log(
            "Push GitHub..."
        );



        this.run(
            `git push origin ${this.config.gitBranch}`
        );



        console.log(
            "\nGitHub mis à jour."
        );


    }



}



module.exports = GitManager;