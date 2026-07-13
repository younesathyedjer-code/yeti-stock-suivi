class TransactionManager {


    constructor(fileManager, backupManager) {

        this.fileManager = fileManager;

        this.backupManager = backupManager;

    }



    execute(plan, sourceRoot) {


        const filesToBackup = [

            ...plan.copies.map(x => x.target),

            ...plan.deletes

        ];



        const backup =
            this.backupManager.create(
                filesToBackup
            );



        for (const action of plan.copies) {


            this.fileManager.copy(

                require("path").join(
                    sourceRoot,
                    action.source
                ),

                action.target

            );


        }



        for (const file of plan.deletes) {


            this.fileManager.delete(
                file
            );


        }



        return {

            success: true,

            backup

        };


    }


}


module.exports = TransactionManager;