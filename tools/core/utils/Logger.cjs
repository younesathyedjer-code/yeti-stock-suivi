const fs = require("fs");
const path = require("path");

class Logger {

    constructor(logFile = null) {
        this.logFile = logFile;
    }

    write(level, message) {

        const line =
            `[${new Date().toISOString()}] [${level}] ${message}`;

        console.log(line);

        if (this.logFile) {

            fs.mkdirSync(
                path.dirname(this.logFile),
                { recursive: true }
            );

            fs.appendFileSync(
                this.logFile,
                line + "\n"
            );

        }

    }

    info(message) {
        this.write("INFO", message);
    }

    success(message) {
        this.write("SUCCESS", message);
    }

    warn(message) {
        this.write("WARNING", message);
    }

    error(message) {
        this.write("ERROR", message);
    }

    debug(message) {
        this.write("DEBUG", message);
    }

}

module.exports = Logger;