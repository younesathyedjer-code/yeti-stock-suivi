const fs = require("fs");
const path = require("path");

class DiffBuilder {

    scan(dir, base = dir) {

        let files = [];

        for (const item of fs.readdirSync(dir)) {

            const full = path.join(dir, item);

            if (fs.statSync(full).isDirectory()) {

                files.push(...this.scan(full, base));

            } else {

                files.push(
                    path.relative(base, full).replace(/\\/g, "/")
                );

            }

        }

        return files;

    }

}

module.exports = DiffBuilder;