const fs = require("fs");
const crypto = require("crypto");

class Helpers {

    static exists(file) {
        return fs.existsSync(file);
    }

    static hash(file) {

        return crypto
            .createHash("sha256")
            .update(fs.readFileSync(file))
            .digest("hex");

    }

    static now() {
        return new Date().toISOString();
    }

}

module.exports = Helpers;