class ReleaseManager {


    constructor(

        buildManager,

        gitManager

    ){


        this.buildManager =
            buildManager;


        this.gitManager =
            gitManager;


    }





    async release(plan){


        const result = {


            build:false,

            capacitorSync:false,

            apk:false,

            git:false,

            success:false


        };





        if(

            plan.build ||

            plan.capacitorSync ||

            plan.apkBuild

        ){


            await this.buildManager.execute(
                plan
            );



            result.build =
                Boolean(
                    plan.build
                );


            result.capacitorSync =
                Boolean(
                    plan.capacitorSync
                );


            result.apk =
                Boolean(
                    plan.apkBuild
                );


        }






        if(plan.gitCommit){


            await this.gitManager.execute(
                plan
            );


            result.git = true;


        }





        result.success = true;



        return result;


    }


}


module.exports = ReleaseManager;