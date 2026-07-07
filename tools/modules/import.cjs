const fs = require("fs");
const path = require("path");



function isProtected(file, config){


    if(config.protectedFiles.includes(file))
        return true;



    return config.protectedFolders.some(folder =>
        file === folder ||
        file.startsWith(folder + path.sep)
    );

}



function ensureFolder(file){


    const folder =
        path.dirname(file);



    if(!fs.existsSync(folder)){


        fs.mkdirSync(
            folder,
            {
                recursive:true
            }
        );

    }

}




function copyFile(source,target){


    ensureFolder(target);


    fs.copyFileSync(
        source,
        target
    );

}




function deleteFile(file,config){


    if(isProtected(file,config)){


        console.log(
            "⚠ Suppression interdite :",
            file
        );


        return;

    }



    const target =
        path.join(
            config.projectRoot,
            file
        );



    if(fs.existsSync(target)){


        fs.unlinkSync(target);


        console.log(
            " - Supprimé :",
            file
        );

    }

}




module.exports = function(config, updatePath, report){



    console.log(
        "\nApplication de la mise à jour..."
    );



    /*
        RENOMMAGES
    */


    for(const item of report.renamed){


        const from =
            path.join(
                config.projectRoot,
                item.from
            );


        const to =
            path.join(
                config.projectRoot,
                item.to
            );



        if(isProtected(item.from,config)){


            console.log(
                "⚠ Renommage interdit :",
                item.from
            );


            continue;

        }



        if(fs.existsSync(from)){


            ensureFolder(to);


            fs.renameSync(
                from,
                to
            );


            console.log(
                "↪ Renommé :",
                item.from,
                "→",
                item.to
            );

        }


    }




    /*
        DEPLACEMENTS
    */


    for(const item of report.moved){


        const from =
            path.join(
                config.projectRoot,
                item.from
            );


        const to =
            path.join(
                config.projectRoot,
                item.to
            );



        if(isProtected(item.from,config)){


            console.log(
                "⚠ Déplacement interdit :",
                item.from
            );


            continue;

        }



        if(fs.existsSync(from)){


            ensureFolder(to);


            fs.renameSync(
                from,
                to
            );


            console.log(
                "→ Déplacé :",
                item.from,
                "→",
                item.to
            );

        }


    }




    /*
        SUPPRESSIONS EXPLICITES
    */


    for(const file of report.deleted){


        deleteFile(
            file,
            config
        );

    }





    /*
        NOUVEAUX FICHIERS
        + MODIFICATIONS
    */


    const files = [

        ...report.added,

        ...report.modified

    ];



    for(const file of files){



        if(isProtected(file,config)){


            console.log(
                "⚠ Modification protégée ignorée :",
                file
            );


            continue;

        }




        const source =
            path.join(
                updatePath,
                file
            );



        const target =
            path.join(
                config.projectRoot,
                file
            );



        copyFile(
            source,
            target
        );



        console.log(
            report.modified.includes(file)
                ? " * Modifié :"
                : " + Ajouté :",
            file
        );

    }



    console.log(
        "\nImport terminé."
    );


};