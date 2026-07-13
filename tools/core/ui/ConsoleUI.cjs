const readline = require("readline");

class ConsoleUI {

    async confirm(message) {

        return new Promise(resolve => {

            const rl = readline.createInterface({

                input: process.stdin,
                output: process.stdout

            });

            rl.question(message + " (O/N) : ", answer => {

                rl.close();

                resolve(
                    answer.trim().toLowerCase() === "o"
                );

            });

        });

    }

}

module.exports = ConsoleUI;