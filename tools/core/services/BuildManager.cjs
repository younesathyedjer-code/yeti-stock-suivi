const { execSync } = require("child_process");


class BuildManager {


    constructor(config) {

        this.config = config;

    }



    execute(plan) {


        if (!plan.build)
            return;



        execSync(
            "npm run build",
            {
                cwd: this.config.projectRoot,
                stdio: "inherit"
            }
        );


    }


}


module.exports = BuildManager;