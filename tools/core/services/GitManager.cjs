const { execSync } = require("child_process");

class GitManager {

    constructor(config) {
        this.config = config;
    }

    execute(plan) {

        if (!plan.gitCommit)
            return;

        execSync("git add .", {
            cwd: this.config.projectRoot,
            stdio: "inherit"
        });

        execSync(
            `git commit -m "Update ${plan.version}"`,
            {
                cwd: this.config.projectRoot,
                stdio: "inherit"
            }
        );

        execSync(
            `git push origin ${this.config.gitBranch}`,
            {
                cwd: this.config.projectRoot,
                stdio: "inherit"
            }
        );

    }

}

module.exports = GitManager;