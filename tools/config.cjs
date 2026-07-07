const path = require("path");

module.exports = {

    // ==============================
    // CHEMINS PRINCIPAUX
    // ==============================

    projectRoot: process.cwd(),

    iaFolder: "C:\\YETISTOCK\\IA",

    tempFolder: "C:\\YETISTOCK\\TempUpdate",

    backupFolder: "C:\\YETISTOCK\\Backups",



    // ==============================
    // DOSSIERS IGNORÉS
    // Jamais comparés
    // Jamais importés
    // ==============================

    ignore: [

        "node_modules",
        "dist",
        "build",

        ".git",
        ".idea",
        ".gradle",

        ".firebase",

        "TempUpdate",
        "Backups"

    ],



    // ==============================
    // ÉLÉMENTS PROTÉGÉS
    // Lecture possible
    // Modification interdite
    // ==============================

    protectedFiles: [

        "firebase.json",
        "capacitor.config.ts",
        ".env",
        ".gitignore"

    ],



    protectedFolders: [

        "android",
        ".github",
        "tools"

    ],



    // ==============================
    // ZONES AUTORISÉES
    // Gestion normale des updates
    // ==============================

    managedFolders: [

        "src",
        "public"

    ],


    managedFiles: [

        "package.json",
        "package-lock.json",
        "index.html"

    ],



    // ==============================
    // FICHIERS DE COMMANDE UPDATE
    // ==============================

    updateFiles: {

        manifest: "manifest.json",

        delete: "delete.json",

        rename: "rename.json",

        move: "move.json"

    },



    // ==============================
    // GIT
    // ==============================

    gitBranch: "main",

    commitMessage:
        "Automatic update from Yeti Update Manager"


};