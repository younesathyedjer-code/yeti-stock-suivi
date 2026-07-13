class ReleaseManager {


    constructor(
        buildManager,
        gitManager
    ) {

        this.buildManager =
            buildManager;

        this.gitManager =
            gitManager;

    }



    async release(plan) {


        const result = {

            build: false,

            git: false,

            success: false

        };



        if (plan.build) {

            await this.buildManager.execute(
                plan
            );

            result.build = true;

        }



        if (plan.gitCommit) {

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