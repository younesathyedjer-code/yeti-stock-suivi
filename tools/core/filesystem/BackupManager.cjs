const fs = require("fs");
const path = require("path");

class BackupManager {


    constructor(config) {

        this.config = config;

    }



    create(files = []) {


        const folder =
            path.join(
                this.config.backupFolder,
                "backup-" + new Date().toISOString()
                .replace(/[:.]/g,"-")
            );


        fs.mkdirSync(
            folder,
            {
                recursive:true
            }
        );



        for (const file of files) {


            const source =
                path.join(
                    this.config.projectRoot,
                    file
                );


            if(!fs.existsSync(source))
                continue;



            const destination =
                path.join(
                    folder,
                    file
                );


            fs.mkdirSync(
                path.dirname(destination),
                {
                    recursive:true
                }
            );


            fs.copyFileSync(
                source,
                destination
            );


        }


        return folder;


    }


}


module.exports = BackupManager;