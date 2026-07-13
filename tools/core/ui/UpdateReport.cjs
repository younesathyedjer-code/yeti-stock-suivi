class UpdateReport {


    display(plan) {


        console.log("");

        console.log("========================================");
        console.log("          RAPPORT UPDATE");
        console.log("========================================");


        console.log("");

        console.log(
            "Version : " +
            plan.version
        );


        console.log(
            "Description : " +
            plan.description
        );


        console.log("");

        console.log(
            "Ajouts : " +
            plan.copies.length
        );


        console.log(
            "Suppressions : " +
            plan.deletes.length
        );


        console.log(
            "Renommages : " +
            plan.renames.length
        );


        console.log(
            "Déplacements : " +
            plan.moves.length
        );


        console.log("");

        console.log("========================================");

        console.log("");

    }


}


module.exports = UpdateReport;