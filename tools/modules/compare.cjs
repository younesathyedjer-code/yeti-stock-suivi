const fs = require("fs");
const path = require("path");


function walk(dir, base, config){

    let files = [];


    if(!fs.existsSync(dir))
        return files;


    for(const item of fs.readdirSync(dir)){


        const full = path.join(dir,item);

        const relative = path.relative(
            base,
            full
        );


        const ignored =
            config.ignore.some(folder =>
                relative === folder ||
                relative.startsWith(folder + path.sep)
            );


        if(ignored)
            continue;



        const stat = fs.statSync(full);



        if(stat.isDirectory()){


            files.push(
                ...walk(
                    full,
                    base,
                    config
                )
            );


        }
        else{


            files.push(relative);


        }


    }


    return files;

}



function readJson(file){


    if(!fs.existsSync(file))
        return [];


    try{

        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );

    }
    catch{

        return [];

    }

}




module.exports = function(config, updatePath){



    console.log(
        "\nComparaison de la mise à jour..."
    );



    const projectFiles =
        walk(
            config.projectRoot,
            config.projectRoot,
            config
        );



    const updateFiles =
        walk(
            updatePath,
            updatePath,
            config
        );



    /*
       AJOUTS
    */

    const added =
        updateFiles.filter(
            file =>
                !projectFiles.includes(file) &&
                !config.updateFiles.manifest.includes(file) &&
                !file.endsWith(".json")
        );



    /*
       MODIFICATIONS
    */

    const modified = [];


    for(const file of updateFiles){


        if(!projectFiles.includes(file))
            continue;



        if(file.endsWith(".json"))
            continue;



        const oldFile =
            path.join(
                config.projectRoot,
                file
            );


        const newFile =
            path.join(
                updatePath,
                file
            );



        const oldData =
            fs.readFileSync(oldFile);



        const newData =
            fs.readFileSync(newFile);



        if(!oldData.equals(newData)){


            modified.push(file);


        }


    }



    /*
       SUPPRESSIONS EXPLICITES
    */


    const deleted =
        readJson(
            path.join(
                updatePath,
                config.updateFiles.delete
            )
        );



    /*
       RENOMMAGES
    */


    const renamed =
        readJson(
            path.join(
                updatePath,
                config.updateFiles.rename
            )
        );



    /*
       DEPLACEMENTS
    */


    const moved =
        readJson(
            path.join(
                updatePath,
                config.updateFiles.move
            )
        );




    return {

        added,

        modified,

        deleted,

        renamed,

        moved

    };


};