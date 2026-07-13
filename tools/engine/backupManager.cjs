const fs = require("fs");
const path = require("path");



class BackupManager {



    constructor(config){


        this.config = config;


    }





    create(){


        console.log(
            "\nCréation du backup..."
        );



        if(!fs.existsSync(this.config.backupFolder)){


            fs.mkdirSync(
                this.config.backupFolder,
                {
                    recursive:true
                }
            );


        }




        const date =
            new Date()
            .toISOString()
            .replace(/[:.]/g,"-");



        const backupPath =
            path.join(
                this.config.backupFolder,
                "backup-" + date
            );



        fs.mkdirSync(
            backupPath,
            {
                recursive:true
            }
        );



        this.copyManaged(
            this.config.projectRoot,
            backupPath
        );



        console.log(
            "Backup créé :"
        );


        console.log(
            backupPath
        );



        return backupPath;


    }








    copyManaged(source,destination,relative=""){



        for(const item of fs.readdirSync(source)){



            const full =
                path.join(
                    source,
                    item
                );



            const rel =
                path.join(
                    relative,
                    item
                )
                .replace(/\\/g,"/");



            if(this.isIgnored(rel))
                continue;




            const target =
                path.join(
                    destination,
                    item
                );



            if(fs.statSync(full).isDirectory()){


                fs.mkdirSync(
                    target,
                    {
                        recursive:true
                    }
                );


                this.copyManaged(
                    full,
                    target,
                    rel
                );


            }
            else{


                fs.copyFileSync(
                    full,
                    target
                );


            }


        }


    }







    isIgnored(file){



        const ignore =
            this.config.ignore || [];



        return ignore.some(folder =>
            file === folder ||
            file.startsWith(
                folder + "/"
            )
        );


    }



}



module.exports = BackupManager;