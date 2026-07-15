const path = require("path");


const load = p =>
    require(
        path.join(
            __dirname,
            p
        )
    );



module.exports = {


    Logger:
        load("utils/Logger.cjs"),



    Helpers:
        load("utils/Helpers.cjs"),



    PackageLoader:
        load("package/PackageLoader.cjs"),



    ManifestReader:
        load("package/ManifestReader.cjs"),



    PackageAnalyzer:
        load("package/PackageAnalyzer.cjs"),



    PlanBuilder:
        load("planner/PlanBuilder.cjs"),



    PlanValidator:
        load("planner/PlanValidator.cjs"),



    DiffBuilder:
        load("planner/DiffBuilder.cjs"),



    FileManager:
        load("filesystem/FileManager.cjs"),



    BackupManager:
        load("filesystem/BackupManager.cjs"),



    RestoreManager:
        load("filesystem/RestoreManager.cjs"),



    TransactionManager:
        load("filesystem/TransactionManager.cjs"),



    SecurityManager:
        load("filesystem/SecurityManager.cjs"),



    BuildManager:
        load("services/BuildManager.cjs"),



    ApkManager:
        load("services/ApkManager.cjs"),



    GitManager:
        load("services/GitManager.cjs"),



    ConsoleUI:
        load("ui/ConsoleUI.cjs"),



    UpdateReport:
        load("ui/UpdateReport.cjs"),



    ReleaseManager:
        load("ReleaseManager.cjs"),



    ReleaseReport:
        load("ui/ReleaseReport.cjs"),



    RestoreEngine:
        load("RestoreEngine.cjs")



};