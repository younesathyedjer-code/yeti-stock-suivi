const Core = require("./Core.cjs");

const CoreConfig =
    require("./config/CoreConfig.cjs");


class UpdateEngine {


    constructor(){


        this.config =
            CoreConfig;


        this.logger =
            new Core.Logger();


        this.packageLoader =
            new Core.PackageLoader(
                this.config
            );


        this.packageAnalyzer =
            new Core.PackageAnalyzer();


        this.diffBuilder =
            new Core.DiffBuilder();


        this.planValidator =
            new Core.PlanValidator(
                this.config
            );


        this.fileManager =
            new Core.FileManager(
                this.config
            );


        this.backupManager =
            new Core.BackupManager(
                this.config
            );


        this.transactionManager =
            new Core.TransactionManager(

                this.fileManager,

                this.backupManager

            );


    }




    async start(){


        this.logger.success(
            "YETI CORE INITIALISÉ"
        );



        const zip =
            this.packageLoader.findLatestZip();



        const extracted =
            this.packageLoader.extract(
                zip
            );



        const info =
            this.packageAnalyzer.analyze(
                extracted
            );



        const manifestReader =
            new Core.ManifestReader(
                info.root
            );



        const manifest =
            manifestReader.load();



        const files =
            this.diffBuilder.scan(
                info.root
            );



        const planBuilder =
            new Core.PlanBuilder(

                manifest,

                {

                    added:files,

                    modified:[],

                    deleted:[]

                }

            );



        const plan =
            planBuilder.build();



        const validation =
            this.planValidator.validate(
                plan
            );



        if(!validation.valid){

            throw new Error(
                "PLAN INVALID"
            );

        }



        const backup =
            await this.backupManager.create();



        this.logger.success(
            "BACKUP : " + backup
        );



        const transaction =
            this.transactionManager.execute(

                plan,

                info.root

            );



        this.logger.success(

            "TRANSACTION : " +

            transaction.success

        );



        return plan;


    }


}

module.exports = UpdateEngine;