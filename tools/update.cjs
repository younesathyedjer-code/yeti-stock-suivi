const config = require("./config.cjs");

const findUpdate = require("./modules/findUpdate.cjs");
const validate = require("./modules/validate.cjs");
const compare = require("./modules/compare.cjs");
const backup = require("./modules/backup.cjs");
const importer = require("./modules/import.cjs");
const build = require("./modules/build.cjs");
const github = require("./modules/github.cjs");

const readline = require("readline");


function ask(question){

    return new Promise(resolve => {

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });


        rl.question(question, answer => {

            rl.close();

            resolve(answer);

        });

    });

}



async function main(){


    console.clear();


    console.log("========================================");
    console.log("       YETI UPDATE MANAGER v3");
    console.log("========================================\n");



    try{


        // 1 - Recherche ZIP

        const updatePath = findUpdate(config);



        // 2 - Validation

        const metadata = validate(
            config,
            updatePath
        );



        // 3 - Comparaison

        const report = compare(
            config,
            updatePath
        );



        console.log("\n========================================");
        console.log(" RAPPORT UPDATE");
        console.log("========================================\n");


        console.log(
            "Version :",
            metadata.version || "non définie"
        );


        console.log(
            "Description :",
            metadata.description || ""
        );


        console.log("\nAjouts :", report.added.length);

        console.log(
            "Modifications :",
            report.modified.length
        );

        console.log(
            "Suppressions demandées :",
            report.deleted.length
        );

        console.log(
            "Renommages :",
            report.renamed.length
        );

        console.log(
            "Déplacements :",
            report.moved.length
        );



        if(report.modified.length){

            console.log("\nFichiers modifiés :");

            report.modified.forEach(f =>
                console.log(" *",f)
            );

        }



        if(report.deleted.length){

            console.log("\nSuppressions demandées :");

            report.deleted.forEach(f =>
                console.log(" -",f)
            );

        }



        console.log("\n========================================");



        const answer = await ask(
            "\nAppliquer cette mise à jour ? (O/N) : "
        );



        if(answer.toUpperCase() !== "O"){

            console.log(
                "\nMise à jour annulée."
            );

            return;

        }



        // 4 - Backup

        backup(config);



        // 5 - Import

        importer(
            config,
            updatePath,
            report
        );



        // 6 - Build

        build(
            config,
            metadata
        );



        // 7 - Git

        github(
            config,
            metadata
        );



        console.log("\n========================================");
        console.log(" UPDATE TERMINÉE AVEC SUCCÈS");
        console.log("========================================");


    }
    catch(error){


        console.log("\n========================================");
        console.log(" ERREUR UPDATE");
        console.log("========================================\n");


        console.log(error.message);


        process.exit(1);

    }

}



main();