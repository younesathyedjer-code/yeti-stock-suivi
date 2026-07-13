const fs = require("fs");
const path = require("path");



class ManifestManager {


    constructor(updatePath){


        this.updatePath = updatePath;

        this.manifest = null;


    }





    load(){


        const file =
            path.join(
                this.updatePath,
                "manifest.json"
            );



        if(!fs.existsSync(file)){


            throw new Error(
                "manifest.json introuvable."
            );


        }



        try{


            this.manifest =
                JSON.parse(
                    fs.readFileSync(
                        file,
                        "utf8"
                    )
                );



        }
        catch(error){


            throw new Error(
                "manifest.json invalide."
            );


        }



        return this.manifest;


    }







    getVersion(){


        return this.manifest?.version || null;


    }





    getDescription(){


        return this.manifest?.description || "";


    }






    needBuild(){


        return this.manifest?.build === true;


    }





    needCapacitorSync(){


        return this.manifest?.capacitorSync === true;


    }





    needFirebaseDeploy(){


        return this.manifest?.firebaseDeploy === true;


    }






    readCommandFile(name){



        const file =
            path.join(
                this.updatePath,
                name
            );



        if(!fs.existsSync(file)){


            return [];


        }



        try{


            return JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );


        }
        catch(error){


            throw new Error(
                name +
                " invalide."
            );


        }


    }







    getDeleteList(){


        return this.readCommandFile(
            "delete.json"
        );


    }






    getRenameList(){


        return this.readCommandFile(
            "rename.json"
        );


    }






    getMoveList(){


        return this.readCommandFile(
            "move.json"
        );


    }



}



module.exports = ManifestManager;