const { execSync } = require("child_process");

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

            capacitorSync: false,

            git: false,

            success: false

        };



        if (plan.build) {

            await this.buildManager.execute(
                plan
            );

            result.build = true;



            execSync(
                "npx cap sync android",
                {
                    cwd: process.cwd(),
                    stdio: "inherit"
                }
            );

            result.capacitorSync = true;

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