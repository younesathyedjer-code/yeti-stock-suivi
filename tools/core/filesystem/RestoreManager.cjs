const fs = require("fs");
const path = require("path");


class RestoreManager {


    constructor(config) {

        this.config = config;

    }



    restore(backupFolder) {


        if(!fs.existsSync(backupFolder)) {

            throw new Error(
                "Backup introuvable."
            );

        }



        this.copyFolder(
            backupFolder,
            this.config.projectRoot
        );



        return true;


    }





    copyFolder(source, destination) {


        for(const item of fs.readdirSync(source)) {


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



            if(fs.statSync(src).isDirectory()) {


                fs.mkdirSync(
                    dest,
                    {
                        recursive:true
                    }
                );


                this.copyFolder(
                    src,
                    dest
                );


            }
            else {


                fs.mkdirSync(
                    path.dirname(dest),
                    {
                        recursive:true
                    }
                );


                fs.copyFileSync(
                    src,
                    dest
                );


            }


        }


    }


}


module.exports = RestoreManager;