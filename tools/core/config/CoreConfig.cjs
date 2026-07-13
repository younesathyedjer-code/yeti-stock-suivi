module.exports = {

    projectRoot: process.cwd(),

    iaFolder:
        "C:\\YETISTOCK\\IA",

    tempFolder:
        "C:\\YETISTOCK\\TempUpdate",

    backupFolder:
        "C:\\YETISTOCK\\Backups",


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


    gitBranch:
        "main"

};