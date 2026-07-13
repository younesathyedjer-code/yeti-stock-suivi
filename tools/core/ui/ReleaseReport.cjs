class ReleaseReport {


    display(result) {


        console.log("");

        console.log("========================================");
        console.log("          RELEASE REPORT");
        console.log("========================================");


        console.log("");

        console.log(
            "Build : " +
            (result.build ? "OK" : "IGNORÉ")
        );


        console.log(
            "Git : " +
            (result.git ? "OK" : "IGNORÉ")
        );


        console.log(
            "Release : " +
            (result.success ? "OK" : "ÉCHEC")
        );


        console.log("");

        console.log("========================================");

        console.log("");

    }


}


module.exports = ReleaseReport;