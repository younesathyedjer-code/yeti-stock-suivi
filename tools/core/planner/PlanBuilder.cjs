const UpdatePlan =
    require("../models/UpdatePlan.cjs");


class PlanBuilder{


    constructor(
        manifest,
        files={}
    ){

        this.manifest = manifest;

        this.files = files;

    }




    build(){


        const plan =
            new UpdatePlan();




        plan.version =
            this.manifest.version ?? "";


        plan.description =
            this.manifest.description ?? "";


        plan.author =
            this.manifest.author ?? "";




        plan.build =
            Boolean(
                this.manifest.build
            );


        plan.capacitorSync =
            Boolean(
                this.manifest.capacitorSync
            );


        plan.apkBuild =
            Boolean(
                this.manifest.apkBuild
            );


        plan.firebaseDeploy =
            Boolean(
                this.manifest.firebaseDeploy
            );


        plan.gitCommit =
            Boolean(
                this.manifest.gitCommit
            );




        for(const file of this.files.added||[]){

            plan.addCopy(
                file,
                file
            );

        }




        for(const file of this.files.modified||[]){

            plan.addCopy(
                file,
                file
            );

        }




        for(const file of this.files.deleted||[]){

            plan.addDelete(
                file
            );

        }




        return plan;


    }


}


module.exports = PlanBuilder;