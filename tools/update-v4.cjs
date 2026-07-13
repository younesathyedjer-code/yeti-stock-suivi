const fs = require("fs");
const path = require("path");
const readline = require("readline");

const config = require("./config.cjs");

const ManifestManager = require("./engine/manifestManager.cjs");
const CompareManager = require("./engine/compareManager.cjs");
const BackupManager = require("./engine/backupManager.cjs");
const FileManager = require("./engine/fileManager.cjs");
const Transaction = require("./engine/transaction.cjs");
const BuildManager = require("./engine/buildManager.cjs");
const GitManager = require("./engine/gitManager.cjs");

const AdmZip = require("adm-zip");





function ask(question){


    const rl =
        readline.createInterface({

            input:process.stdin,

            output:process.stdout

        });



    return new Promise(resolve => {


        rl.question(
            question,
            answer => {

                rl.close();

                resolve(answer.trim());

            }
        );


    });


}






function findZip(){


    const files =
        fs.readdirSync(
            config.iaFolder
        )
        .filter(f =>
            f.endsWith(".zip")
        );



    if(files.length === 0){


        throw new Error(
            "Aucun ZIP trouvé dans IA."
        );


    }



    return path.join(
        config.iaFolder,
        files[files.length-1]
    );


}






function extract(zip){


    if(fs.existsSync(config.tempFolder)){


        fs.rmSync(
            config.tempFolder,
            {
                recursive:true,
                force:true
            }
        );


    }



    fs.mkdirSync(
        config.tempFolder,
        {
            recursive:true
        }
    );



    const adm =
        new AdmZip(zip);



    adm.extractAllTo(
        config.tempFolder,
        true
    );



    const folders =
        fs.readdirSync(
            config.tempFolder
        );



    if(
        folders.length === 1 &&
        fs.statSync(
            path.join(
                config.tempFolder,
                folders[0]
            )
        ).isDirectory()
    ){

        return path.join(
            config.tempFolder,
            folders[0]
        );


    }



    return config.tempFolder;


}







async function main(){



console.log(`
========================================
 YETI UPDATE MANAGER v4
========================================
`);





try{



console.log(
    "Recherche du dernier ZIP..."
);



const zip =
    findZip();



console.log(
    "\nZIP détecté :"
);

console.log(zip);





console.log(
    "\nExtraction..."
);



const updatePath =
    extract(zip);



console.log(
    "Dossier update :"
);

console.log(updatePath);






const manifestManager =
    new ManifestManager(
        updatePath
    );



const manifest =
    manifestManager.load();





console.log(
    "\nValidation manifest..."
);



console.log(
    "Version :",
    manifestManager.getVersion()
);



console.log(
    "Description :",
    manifestManager.getDescription()
);








const compareManager =
    new CompareManager(
        config
    );



const report =
    compareManager.compare(
        config.projectRoot,
        updatePath
    );





console.log(`
========================================
 RAPPORT UPDATE
========================================
`);

console.log(
    "Ajouts :",
    report.added.length
);

console.log(
    "Modifications :",
    report.modified.length
);





if(report.added.length){


    console.log(
        "\nNouveaux fichiers:"
    );


    report.added.forEach(f =>
        console.log(
            " + " + f
        )
    );


}



if(report.modified.length){


    console.log(
        "\nFichiers modifiés:"
    );


    report.modified.forEach(f =>
        console.log(
            " * " + f
        )
    );


}





console.log(
    "\n========================================"
);




const answer =
    await ask(
        "Appliquer cette mise à jour ? (O/N) : "
    );



if(answer.toUpperCase() !== "O"){


    console.log(
        "Mise à jour annulée."
    );


    return;


}





const backupManager =
    new BackupManager(
        config
    );



backupManager.create();







const fileManager =
    new FileManager(
        config
    );





for(const file of report.added){


    fileManager.addCopy(
        file,
        file
    );


}



for(const file of report.modified){


    fileManager.addCopy(
        file,
        file
    );


}






const errors =
    fileManager.validate();



if(errors.length){


    console.log(
        errors
    );


    throw new Error(
        "Plan invalide."
    );


}







const transaction =
    new Transaction(
        {
            ...config,
            updatePath
        },
        fileManager
    );



const success =
    transaction.execute();



if(!success){


    throw new Error(
        "Transaction échouée."
    );


}







const build =
    new BuildManager(
        config,
        manifest
    );


build.build();






const git =
    new GitManager(
        config,
        manifest
    );


git.commitAndPush();






console.log(`
========================================
 UPDATE TERMINÉE AVEC SUCCÈS
========================================
`);





}
catch(error){


console.log(`
========================================
 ERREUR UPDATE
========================================
`);


console.log(
    error.message
);


}



}



main();