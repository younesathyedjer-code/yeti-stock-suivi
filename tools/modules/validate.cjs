const fs = require("fs");
const path = require("path");


module.exports = function(config, updatePath){


    console.log("\nValidation de la mise à jour...");



    const manifestPath =
        path.join(
            updatePath,
            config.updateFiles.manifest
        );



    if(!fs.existsSync(manifestPath)){


        throw new Error(
            "manifest.json absent. Mise à jour refusée."
        );

    }



    let manifest;



    try{


        manifest = JSON.parse(
            fs.readFileSync(
                manifestPath,
                "utf8"
            )
        );


    }
    catch(error){


        throw new Error(
            "manifest.json invalide."
        );


    }




    if(!manifest.version){


        throw new Error(
            "Version absente dans manifest.json."
        );


    }




    console.log(
        "Version :",
        manifest.version
    );



    if(manifest.description){


        console.log(
            "Description :",
            manifest.description
        );


    }




    const commandFiles = [

        config.updateFiles.delete,

        config.updateFiles.rename,

        config.updateFiles.move

    ];



    for(const file of commandFiles){



        const target =
            path.join(
                updatePath,
                file
            );



        if(fs.existsSync(target)){



            try{


                JSON.parse(
                    fs.readFileSync(
                        target,
                        "utf8"
                    )
                );


            }
            catch(error){


                throw new Error(
                    file +
                    " contient un JSON invalide."
                );


            }


        }


    }




    console.log(
        "Validation OK."
    );



    return manifest;


};