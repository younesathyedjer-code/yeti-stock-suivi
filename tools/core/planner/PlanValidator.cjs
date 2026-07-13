const CoreConfig =
    require("../config/CoreConfig.cjs");


class PlanValidator {


    constructor(config = CoreConfig) {

        this.config = config;

    }



    validate(plan) {


        const errors = [];

        const blockedActions =
            plan.blockedActions || [];



        if (blockedActions.length > 0) {

            errors.push(
                ...blockedActions
            );

        }



        return {

            valid:
                errors.length === 0,

            errors

        };


    }



    isProtected(file) {


        const protectedFiles =
            this.config.protectedFiles || [];



        const protectedFolders =
            this.config.protectedFolders || [];



        if (
            protectedFiles.includes(file)
        ) {

            return true;

        }



        return protectedFolders.some(folder =>
            file.startsWith(folder)
        );


    }


}


module.exports = PlanValidator;