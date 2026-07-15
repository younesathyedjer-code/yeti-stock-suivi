class ReleaseReport {


    display(result){


        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "          RELEASE REPORT"
        );

        console.log(
            "========================================"
        );



        console.log("");



        console.log(
            "Build : " +
            (
                result.build
                ? "OK"
                : "IGNORÉ"
            )
        );



        console.log(
            "Capacitor Sync : " +
            (
                result.capacitorSync
                ? "OK"
                : "IGNORÉ"
            )
        );



        console.log(
            "APK Release : " +
            (
                result.apk
                ? "OK"
                : "IGNORÉ"
            )
        );



        console.log(
            "Git : " +
            (
                result.git
                ? "OK"
                : "IGNORÉ"
            )
        );



        console.log("");

        console.log(
            "Release : " +
            (
                result.success
                ? "OK"
                : "ERREUR"
            )
        );



        console.log("");

        console.log(
            "========================================"
        );

        console.log("");



    }


}



module.exports = ReleaseReport;