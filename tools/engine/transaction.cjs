const fs = require("fs");
const path = require("path");



class Transaction {


    constructor(config, fileManager){


        this.config = config;

        this.fileManager = fileManager;

        this.executed = [];

    }




    ensureFolder(file){


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





    backupBeforeChange(file){


        const source =
            path.join(
                this.config.projectRoot,
                file
            );



        if(!fs.existsSync(source))
            return null;



        const backupFolder =
            path.join(
                this.config.tempFolder || "TempTransaction",
                "rollback"
            );



        const destination =
            path.join(
                backupFolder,
                file
            );



        this.ensureFolder(
            destination
        );



        fs.copyFileSync(
            source,
            destination
        );



        return destination;


    }






    execute(){


        const plan =
            this.fileManager.getPlan();



        console.log(
            "\nExécution transaction..."
        );



        try{



            for(const op of plan){



                console.log(
                    "→",
                    op.type,
                    op.file || op.from
                );



                switch(op.type){



                    case "COPY":


                        this.copy(
                            op.source,
                            op.target
                        );


                    break;




                    case "DELETE":


                        this.remove(
                            op.file
                        );


                    break;




                    case "RENAME":


                        this.rename(
                            op.from,
                            op.to
                        );


                    break;




                    case "MOVE":


                        this.rename(
                            op.from,
                            op.to
                        );


                    break;



                }


            }



            console.log(
                "\nTransaction terminée."
            );



            return true;


        }
        catch(error){


            console.log(
                "\nErreur transaction."
            );


            console.log(
                error.message
            );



            this.rollback();


            return false;


        }



    }







    copy(source,target){



        const from =
            path.isAbsolute(source)
                ? source
                : path.join(
                    this.config.updatePath,
                    source
                );



        const to =
            path.join(
                this.config.projectRoot,
                target
            );



        this.backupBeforeChange(
            target
        );



        this.ensureFolder(
            to
        );



        fs.copyFileSync(
            from,
            to
        );



        this.executed.push({
            type:"COPY",
            file:target
        });


    }







    remove(file){



        const target =
            path.join(
                this.config.projectRoot,
                file
            );



        this.backupBeforeChange(
            file
        );



        if(fs.existsSync(target)){


            fs.rmSync(
                target
            );


        }



        this.executed.push({
            type:"DELETE",
            file
        });


    }






    rename(from,to){



        const oldPath =
            path.join(
                this.config.projectRoot,
                from
            );



        const newPath =
            path.join(
                this.config.projectRoot,
                to
            );



        this.backupBeforeChange(
            from
        );



        this.ensureFolder(
            newPath
        );



        fs.renameSync(
            oldPath,
            newPath
        );



        this.executed.push({
            type:"RENAME",
            from,
            to
        });


    }







    rollback(){



        console.log(
            "Rollback automatique..."
        );



        const rollbackFolder =
            path.join(
                this.config.tempFolder || "TempTransaction",
                "rollback"
            );



        if(!fs.existsSync(rollbackFolder)){


            console.log(
                "Aucun rollback disponible."
            );


            return;


        }



        console.log(
            "Restauration des fichiers modifiés."
        );



        this.restoreFolder(
            rollbackFolder
        );



    }







    restoreFolder(folder,base=folder){



        for(const item of fs.readdirSync(folder)){



            const source =
                path.join(
                    folder,
                    item
                );



            const relative =
                path.relative(
                    base,
                    source
                );



            const target =
                path.join(
                    this.config.projectRoot,
                    relative
                );



            if(fs.statSync(source).isDirectory()){


                this.restoreFolder(
                    source,
                    base
                );


            }
            else{


                this.ensureFolder(
                    target
                );


                fs.copyFileSync(
                    source,
                    target
                );


            }



        }


    }



}



module.exports = Transaction;