const fs = require("fs");
const path = require("path");


class RestoreManager {


    constructor(config){


        this.config = config;


    }





    list(){


        if(!fs.existsSync(this.config.backupFolder)){


            return [];


        }



        return fs.readdirSync(
            this.config.backupFolder
        )
        .filter(item =>
            item.startsWith("backup-")
        )
        .sort()
        .reverse();


    }






    restore(backupName){


        const backupPath =
            path.join(
                this.config.backupFolder,
                backupName
            );



        if(!fs.existsSync(backupPath)){


            throw new Error(
                "Backup introuvable : " +
                backupName
            );


        }



        console.log(
            "\nRestauration depuis :"
        );


        console.log(
            backupPath
        );



        this.copyBack(
            backupPath,
            backupPath
        );



        console.log(
            "\nRestauration terminée."
        );


    }







    copyBack(source,base){



        for(const item of fs.readdirSync(source)){



            const full =
                path.join(
                    source,
                    item
                );



            const relative =
                path.relative(
                    base,
                    full
                )
                .replace(/\\/g,"/");



            if(this.isIgnored(relative))
                continue;



            const target =
                path.join(
                    this.config.projectRoot,
                    relative
                );



            if(fs.statSync(full).isDirectory()){



                if(!fs.existsSync(target)){


                    fs.mkdirSync(
                        target,
                        {
                            recursive:true
                        }
                    );


                }



                this.copyBack(
                    full,
                    base
                );


            }
            else{



                fs.mkdirSync(
                    path.dirname(target),
                    {
                        recursive:true
                    }
                );



                fs.copyFileSync(
                    full,
                    target
                );


                console.log(
                    "Restauré :",
                    relative
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


module.exports = RestoreManager;