const fs = require("fs");
const path = require("path");


class FileManager {


    constructor(config){

        this.config = config;

        this.operations = [];

    }



    normalize(file){

        return file
            .replace(/\//g, path.sep)
            .replace(/^[/\\]+/, "");

    }



    absolute(file){

        return path.join(
            this.config.projectRoot,
            this.normalize(file)
        );

    }



    isProtected(file){


        const target =
            this.normalize(file);



        if(
            this.config.protectedFiles &&
            this.config.protectedFiles.includes(target)
        ){

            return true;

        }



        if(
            this.config.protectedFolders &&
            this.config.protectedFolders.some(folder =>
                target === folder ||
                target.startsWith(folder + path.sep)
            )
        ){

            return true;

        }



        return false;

    }





    exists(file){


        return fs.existsSync(
            this.absolute(file)
        );


    }





    addCopy(source,target){


        this.operations.push({

            type:"COPY",

            source,

            target

        });


    }





    addDelete(file){


        this.operations.push({

            type:"DELETE",

            file

        });


    }





    addRename(from,to){


        this.operations.push({

            type:"RENAME",

            from,

            to

        });


    }





    addMove(from,to){


        this.operations.push({

            type:"MOVE",

            from,

            to

        });


    }





    validate(){


        const errors = [];



        for(const op of this.operations){



            switch(op.type){


                case "DELETE":


                    if(
                        this.isProtected(op.file)
                    ){

                        errors.push(
                            "Suppression protégée : " + op.file
                        );

                    }

                break;



                case "RENAME":


                case "MOVE":


                    if(
                        this.isProtected(op.from)
                    ){

                        errors.push(
                            "Modification protégée : " + op.from
                        );

                    }

                break;



                case "COPY":


                    if(
                        this.isProtected(op.target)
                    ){

                        errors.push(
                            "Écriture protégée : " + op.target
                        );

                    }

                break;


            }


        }



        return errors;


    }






    getPlan(){


        return this.operations;


    }




    clear(){


        this.operations = [];


    }



}



module.exports = FileManager;