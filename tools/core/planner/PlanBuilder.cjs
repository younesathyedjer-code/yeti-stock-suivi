const UpdatePlan = require("../models/UpdatePlan.cjs");


class PlanBuilder {


    constructor(manifest, files = {}) {

        this.manifest = manifest;

        this.files = files;

    }




    build() {


        const plan =
            new UpdatePlan();



        plan.version =
            this.manifest.version || null;



        plan.description =
            this.manifest.description || "";



        plan.author =
            this.manifest.author || null;




        plan.build =
            this.manifest.build || false;



        plan.capacitorSync =
            this.manifest.capacitorSync || false;



        plan.androidRelease =
            this.manifest.androidRelease || false;



        plan.firebaseDeploy =
            this.manifest.firebaseDeploy || false;



        plan.gitCommit =
            this.manifest.gitCommit || false;





        for (const file of this.files.added || []) {


            plan.addCopy(
                file,
                file
            );


        }





        for (const file of this.files.modified || []) {


            plan.addCopy(
                file,
                file
            );


        }




        return plan;


    }


}


module.exports = PlanBuilder;