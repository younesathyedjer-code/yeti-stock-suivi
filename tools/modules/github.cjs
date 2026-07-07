const { execSync } = require("child_process");



function run(command, config){


    return execSync(
        command,
        {
            cwd: config.projectRoot,
            encoding:"utf8"
        }
    ).trim();


}




module.exports = function(config, manifest){



    console.log(
        "\n========================================"
    );

    console.log(
        " GITHUB SYSTEM v3"
    );

    console.log(
        "========================================\n"
    );



    try{



        const status =
            run(
                "git status --porcelain",
                config
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


        run(
            "git add .",
            config
        );





        let message =
            config.commitMessage;



        if(manifest){


            message =
                "Update " +
                (manifest.version || "") +
                " - " +
                (
                    manifest.description ||
                    "Automatic update"
                );


        }




        console.log(
            "Commit :",
            message
        );



        run(
            `git commit -m "${message}"`,
            config
        );





        console.log(
            "Push GitHub..."
        );



        run(
            `git push origin ${config.gitBranch}`,
            config
        );



        console.log(
            "\nGitHub mis à jour."
        );



    }
    catch(error){


        console.log(
            "\nErreur GitHub :"
        );


        console.log(
            error.message
        );


        throw error;


    }


};