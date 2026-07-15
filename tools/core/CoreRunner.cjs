const Core =
    require("./Core.cjs");


const CoreConfig =
    require("./config/ConfigLoader.cjs");


const UpdateEngine =
    require("./UpdateEngine.cjs");



class CoreRunner {


    constructor(){


        this.engine =
            new UpdateEngine();



        this.ui =
            new Core.ConsoleUI();



        this.report =
            new Core.UpdateReport();



        this.release =
            new Core.ReleaseManager(


                new Core.BuildManager(
                    CoreConfig
                ),



                new Core.GitManager(
                    CoreConfig
                )


            );



        this.releaseReport =
            new Core.ReleaseReport();


    }






    async run(){


        console.clear();



        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "        YETI UPDATE MANAGER v5"
        );

        console.log(
            "========================================"
        );

        console.log("");





        const ok =
            await this.ui.confirm(
                "Lancer la mise à jour ?"
            );




        if(!ok){


            console.log(
                "Mise à jour annulée."
            );


            return;


        }






        try{


            const plan =
                await this.engine.start();




            this.report.display(
                plan
            );




            const releaseResult =
                await this.release.release(
                    plan
                );




            this.releaseReport.display(
                releaseResult
            );




            console.log("");

            console.log(
                "UPDATE TERMINÉ AVEC SUCCÈS"
            );



        }


        catch(error){


            console.log("");

            console.log(
                "ERREUR : " +
                error.message
            );


            throw error;


        }



    }


}


module.exports = CoreRunner;