const path = require("path");

const config = require(path.join(__dirname, "config.cjs"));

const Core = require(path.join(__dirname, "core", "Core.cjs"));

console.log("");

console.log("YETI CORE");

console.log("========================");

console.log("");

console.log("Modules chargés :");

Object.keys(Core).forEach(x => {

    console.log("✓ " + x);

});

console.log("");

console.log("CORE INITIALISÉ");