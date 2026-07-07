const { execSync } = require("child_process");



function run(command, config){


    console.log(
        "\n> " + command
    );


    execSync(
        command,
        {
            cwd: config.projectRoot,
            stdio:"inherit"
        }
    );


}




module.exports = function(config, manifest){



    console.log(
        "\n========================================"
    );

    console.log(
        " BUILD SYSTEM v3"
    );

    console.log(
        "========================================\n"
    );




    if(!manifest){


        console.log(
            "Aucun manifest trouvé. Build ignoré."
        );


        return;

    }




    /*
        BUILD WEB
    */


    if(manifest.build === true){


        console.log(
            "Construction Vite..."
        );


        run(
            "npm run build",
            config
        );


        console.log(
            "Build web terminé."
        );


    }
    else{


        console.log(
            "Build web non demandé."
        );


    }





    /*
        CAPACITOR
    */


    if(manifest.capacitorSync === true){


        console.log(
            "\nSynchronisation Capacitor Android..."
        );


        run(
            "npx cap sync android",
            config
        );


        console.log(
            "Synchronisation Android terminée."
        );


    }
    else{


        console.log(
            "Synchronisation Android non demandée."
        );


    }





    /*
        FIREBASE
    */


    if(manifest.firebaseDeploy === true){


        console.log(
            "\nDéploiement Firebase demandé."
        );


        console.log(
            "Sera exécuté par GitHub Actions."
        );


    }




    console.log(
        "\nBUILD SYSTEM terminé."
    );


};