class UpdatePlan {


    constructor(){


        this.version = "";

        this.description = "";

        this.author = "";

        this.createdAt =
            new Date().toISOString();



        this.copies = [];

        this.deletes = [];

        this.renames = [];

        this.moves = [];



        this.build = false;

        this.capacitorSync = false;

        this.apkBuild = false;

        this.firebaseDeploy = false;

        this.gitCommit = false;



        this.blockedActions = [];

        this.requireConfirmation = true;

        this.packageHash = null;

        this.rollbackAvailable = false;


    }






    addCopy(source,target){

        this.copies.push({

            source,

            target

        });

    }





    addDelete(file){

        this.deletes.push(file);

    }





    addRename(from,to){

        this.renames.push({

            from,

            to

        });

    }





    addMove(from,to){

        this.moves.push({

            from,

            to

        });

    }





    hasActions(){

        return (

            this.copies.length>0 ||

            this.deletes.length>0 ||

            this.renames.length>0 ||

            this.moves.length>0

        );

    }





    toJSON(){

        return {

            version:
                this.version,

            description:
                this.description,

            author:
                this.author,

            createdAt:
                this.createdAt,

            copies:
                this.copies,

            deletes:
                this.deletes,

            renames:
                this.renames,

            moves:
                this.moves,

            build:
                this.build,

            capacitorSync:
                this.capacitorSync,

            apkBuild:
                this.apkBuild,

            firebaseDeploy:
                this.firebaseDeploy,

            gitCommit:
                this.gitCommit,

            blockedActions:
                this.blockedActions,

            requireConfirmation:
                this.requireConfirmation,

            packageHash:
                this.packageHash,

            rollbackAvailable:
                this.rollbackAvailable

        };

    }


}


module.exports = UpdatePlan;