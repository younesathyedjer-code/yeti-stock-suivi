const fs = require("fs");
const path = require("path");


class CompareManager {


    constructor(config){


        this.config = config;


        this.ignoreUpdateFiles = [

            "manifest.json",
            "delete.json",
            "rename.json",
            "move.json"

        ];


    }





    scan(dir, base = dir){


        let files = [];


        if(!fs.existsSync(dir))
            return files;



        for(const item of fs.readdirSync(dir)){



            const full =
                path.join(
                    dir,
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



            if(fs.statSync(full).isDirectory()){


                files.push(
                    ...this.scan(
                        full,
                        base
                    )
                );


            }
            else{


                files.push(relative);


            }


        }



        return files;


    }







    isIgnored(file){



        const ignored =
            [
                ...(this.config.ignore || []),
                ...this.ignoreUpdateFiles
            ];



        return ignored.some(item =>

            file === item ||
            file.startsWith(
                item + "/"
            )

        );


    }








    compare(projectPath, updatePath){



        const current =
            this.scan(
                projectPath
            );



        const update =
            this.scan(
                updatePath
            );



        const added =
            update.filter(
                file =>
                !current.includes(file)
            );



        const modified = [];



        for(const file of update){



            if(!current.includes(file))
                continue;



            const oldFile =
                path.join(
                    projectPath,
                    file
                );



            const newFile =
                path.join(
                    updatePath,
                    file
                );



            const oldData =
                fs.readFileSync(
                    oldFile
                );



            const newData =
                fs.readFileSync(
                    newFile
                );



            if(!oldData.equals(newData)){


                modified.push(file);


            }


        }




        return {

            added,

            modified,

            removed:[]

        };


    }



}



module.exports = CompareManager;