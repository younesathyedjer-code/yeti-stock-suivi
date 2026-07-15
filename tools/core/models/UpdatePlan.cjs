class UpdatePlan {
  constructor(manifest) {
    this.version = manifest.version || '0.0.0';
    this.description = manifest.description || '';
    this.build = manifest.build !== undefined ? !!manifest.build : true;
    this.capacitorSync = manifest.capacitorSync !== undefined ? !!manifest.capacitorSync : false;
    this.firebaseDeploy = manifest.firebaseDeploy !== undefined ? !!manifest.firebaseDeploy : false;
    this.gitCommit = manifest.gitCommit !== undefined ? !!manifest.gitCommit : true;
    this.apkRelease = manifest.apkRelease !== undefined ? !!manifest.apkRelease : false;
  }

  summary() {
    return `
=== PLAN D'UPDATE ===
Version       : ${this.version}
Description   : ${this.description}
Vite Build    : ${this.build ? 'OUI' : 'NON'}
Capacitor Sync: ${this.capacitorSync ? 'OUI' : 'NON'}
APK Release   : ${this.apkRelease ? 'OUI' : 'NON'}
Firebase      : ${this.firebaseDeploy ? 'OUI' : 'NON'}
Git Sync      : ${this.gitCommit ? 'OUI' : 'NON'}
====================`;
  }
}

module.exports = UpdatePlan;
