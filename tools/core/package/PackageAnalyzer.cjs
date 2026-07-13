const fs = require("fs");
const path = require("path");


class PackageAnalyzer {


    constructor(packagePath) {

        this.packagePath = packagePath;

    }



    findRoot() {


        const dir = this.packagePath;


        const items =
            fs.readdirSync(dir);



        const folders =
            items.filter(item => {


                const full =
                    path.join(
                        dir,
                        item
                    );


                return fs.statSync(full).isDirectory();


            });



        if (
            folders.length === 1 &&
            fs.existsSync(
                path.join(
                    dir,
                    folders[0],
                    "manifest.json"
                )
            )
        ) {


            return path.join(
                dir,
                folders[0]
            );


        }



        return dir;


    }




    analyze(packagePath = null) {


        if (packagePath) {

            this.packagePath = packagePath;

        }



        const root =
            this.findRoot();



        return {

            root,

            manifest:
                path.join(
                    root,
                    "manifest.json"
                ),

            patch:
                path.join(
                    root,
                    "patch"
                )

        };


    }


}


module.exports = PackageAnalyzer;