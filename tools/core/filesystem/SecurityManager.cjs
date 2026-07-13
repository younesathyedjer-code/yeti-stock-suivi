class SecurityManager {

    constructor(config) {

        this.config = config;

    }

    isProtected(file) {

        if ((this.config.protectedFiles || []).includes(file))
            return true;

        return (this.config.protectedFolders || []).some(folder =>
            file === folder ||
            file.startsWith(folder + "/")
        );

    }

}

module.exports = SecurityManager;