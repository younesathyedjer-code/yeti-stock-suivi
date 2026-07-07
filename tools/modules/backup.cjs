const fs = require("fs");
const path = require("path");


function copyRecursive(source, destination, config){


    if(!fs.existsSync(destination)){


        fs.mkdirSync(
            destination,
            {
                recursive:true
            }
        );

    }



    for(const item of fs.readdirSync(source)){


        const src =
            path.join(
                source,
                item
            );


        const relative =
            path.relative(
                config.projectRoot,
                src
            );



        const ignored =
            config.ignore.some(folder =>
                relative === folder ||
                relative.startsWith(folder + path.sep)
            );



        if(ignored)
            continue;




        const dest =
            path.join(
                destination,
                item
            );



        if(fs.statSync(src).isDirectory()){


            copyRecursive(
                src,
                dest,
                config
            );


        }
        else{


            fs.copyFileSync(
                src,
                dest
            );


        }


    }


}




module.exports = function(config){



    console.log(
        "\nCréation du backup..."
    );



    if(!fs.existsSync(config.backupFolder)){


        fs.mkdirSync(
            config.backupFolder,
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
            config.backupFolder,
            "backup-" + date
        );



    copyRecursive(
        config.projectRoot,
        backupPath,
        config
    );



    console.log(
        "Backup créé :"
    );


    console.log(
        backupPath
    );



    return backupPath;


};