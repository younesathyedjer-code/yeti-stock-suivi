const Core = require("./core/Core.cjs");

const Config =
    require("./core/config/ConfigLoader.cjs");

(async () => {

    console.clear();

    console.log("");
    console.log("========================================");
    console.log("         YETI RESTORE");
    console.log("========================================");
    console.log("");

    try {

        const restore =
            new Core.RestoreEngine(

                Config,

                new Core.RestoreManager(
                    Config
                )

            );

        const backup =
            restore.restore();

        console.log("");

        console.log("Dernière sauvegarde restaurée :");

        console.log(backup);

        console.log("");

        console.log("RESTAURATION TERMINÉE");

        console.log("");

    }

    catch(err) {

        console.log("");

        console.log("ERREUR :");

        console.log(err.message);

        console.log("");

    }

})();