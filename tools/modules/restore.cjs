const fs = require("fs");
const path = require("path");


function copyRecursive(source, destination){


    if(!fs.existsSync(destination)){

        fs.mkdirSync(
            destination,
            {
                recursive:true
            }
        );

    }


    for(const item of fs.readdirSync(source)){


        const src =
            path.join(
                source,
                item
            );


        const dest =
            path.join(
                destination,
                item
            );



        if(fs.statSync(src).isDirectory()){


            copyRecursive(
                src,
                dest
            );


        }
        else{


            fs.copyFileSync(
                src,
                dest
            );


        }


    }


}



module.exports = function(config, backupName){



    const backupPath =
        path.join(
            config.backupFolder,
            backupName
        );



    if(!fs.existsSync(backupPath)){


        throw new Error(
            "Backup introuvable : " +
            backupName
        );


    }



    console.log(
        "\nRestauration du backup :"
    );


    console.log(
        backupPath
    );



    console.log(
        "\nNettoyage du projet actuel..."
    );



    for(const item of fs.readdirSync(config.projectRoot)){


        const target =
            path.join(
                config.projectRoot,
                item
            );


        fs.rmSync(
            target,
            {
                recursive:true,
                force:true
            }
        );


    }



    console.log(
        "Copie du backup..."
    );



    copyRecursive(
        backupPath,
        config.projectRoot
    );



    console.log(
        "\nRollback terminé."
    );


};