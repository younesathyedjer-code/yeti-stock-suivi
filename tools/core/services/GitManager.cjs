const { execSync } = require("child_process");


class GitManager {


    constructor(config) {

        this.config = config;

    }



    execute(plan) {


        if (!plan.gitCommit) {

            console.log(
                "Git ignoré."
            );

            return true;

        }



        try {


            execSync(
                "git add .",
                {
                    cwd: this.config.projectRoot,
                    stdio: "inherit"
                }
            );



            const status =
                execSync(
                    "git status --porcelain",
                    {
                        cwd: this.config.projectRoot,
                        encoding: "utf8"
                    }
                );



            if (!status.trim()) {


                console.log(
                    "Aucun changement Git détecté."
                );


                return true;


            }



            execSync(
                `git commit -m "Update ${plan.version}"`,
                {
                    cwd: this.config.projectRoot,
                    stdio: "inherit"
                }
            );



            if (this.config.gitBranch) {


                execSync(
                    `git push origin ${this.config.gitBranch}`,
                    {
                        cwd: this.config.projectRoot,
                        stdio: "inherit"
                    }
                );


            }



            console.log(
                "Git : OK"
            );


            return true;



        }
        catch(error) {


            console.log(
                "Erreur Git : " + error.message
            );


            throw error;


        }


    }


}


module.exports = GitManager;