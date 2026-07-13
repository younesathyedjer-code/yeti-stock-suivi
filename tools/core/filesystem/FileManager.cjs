const fs = require("fs");
const path = require("path");


class FileManager {


    constructor(config) {

        this.config = config;

    }



    copy(source, target) {


        const destination =
            path.join(
                this.config.projectRoot,
                target
            );


        fs.mkdirSync(
            path.dirname(destination),
            {
                recursive:true
            }
        );


        fs.copyFileSync(
            source,
            destination
        );


    }





    delete(file) {


        const target =
            path.join(
                this.config.projectRoot,
                file
            );


        if(fs.existsSync(target)) {


            fs.rmSync(
                target,
                {
                    force:true
                }
            );


        }


    }


}


module.exports = FileManager;