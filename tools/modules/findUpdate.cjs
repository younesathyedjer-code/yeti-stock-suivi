const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");


module.exports = function(config){


    console.log("Recherche du dernier ZIP...");



    if(!fs.existsSync(config.iaFolder)){

        throw new Error(
            "Le dossier IA est introuvable : " +
            config.iaFolder
        );

    }



    const files = fs.readdirSync(
        config.iaFolder
    );


    const zips = files
        .filter(file =>
            file.toLowerCase().endsWith(".zip")
        )
        .map(file => ({

            name:file,

            date:
                fs.statSync(
                    path.join(
                        config.iaFolder,
                        file
                    )
                ).mtimeMs

        }))
        .sort((a,b)=> b.date - a.date);



    if(zips.length === 0){

        throw new Error(
            "Aucun fichier ZIP trouvé."
        );

    }



    const zipPath = path.join(
        config.iaFolder,
        zips[0].name
    );



    console.log("\nZIP détecté :");

    console.log(zipPath);



    // Nettoyage ancien dossier temporaire

    if(fs.existsSync(config.tempFolder)){

        fs.rmSync(
            config.tempFolder,
            {
                recursive:true,
                force:true
            }
        );

    }



    fs.mkdirSync(
        config.tempFolder,
        {
            recursive:true
        }
    );



    console.log(
        "\nExtraction du ZIP..."
    );



    const zip = new AdmZip(
        zipPath
    );


    zip.extractAllTo(
        config.tempFolder,
        true
    );



    let updateRoot =
        config.tempFolder;



    const content =
        fs.readdirSync(
            config.tempFolder
        );



    /*
       Certains ZIP créés par IA Studio
       contiennent un dossier racine.
       On descend automatiquement dedans.
    */


    if(content.length === 1){


        const possible =
            path.join(
                config.tempFolder,
                content[0]
            );


        if(
            fs.existsSync(possible) &&
            fs.statSync(possible).isDirectory()
        ){

            updateRoot = possible;

        }

    }



    console.log(
        "\nDossier update :"
    );

    console.log(updateRoot);



    return updateRoot;


};