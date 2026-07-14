class ReleaseManager {


    constructor(
        buildManager,
        gitManager,
        apkManager
    ) {


        this.buildManager =
            buildManager;


        this.gitManager =
            gitManager;


        this.apkManager =
            apkManager;


    }





    async release(plan) {


        const result = {


            build:false,

            capacitorSync:false,

            apk:false,

            git:false,

            success:false


        };





        if(plan.build){


            await this.buildManager.execute(
                plan
            );


            result.build = true;


        }






        if(plan.capacitorSync){


            result.capacitorSync = true;


        }





        if(plan.apkBuild){


            const apk =
                await this.apkManager.execute(
                    plan
                );


            result.apk = apk;


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