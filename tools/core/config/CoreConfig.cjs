const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../..');

const CoreConfig = {
  paths: {
    root: ROOT_DIR,
    manifest: path.join(ROOT_DIR, 'manifest.json'),
    src: path.join(ROOT_DIR, 'src'),
    dist: path.join(ROOT_DIR, 'dist'),
    android: path.join(ROOT_DIR, 'android'),
    backup: path.join(ROOT_DIR, '.yeti_backups'),
    updates: path.join(ROOT_DIR, 'updates'),
  },
  commands: {
    build: 'npm run build',
    capSync: 'npx cap sync android',
    firebaseDeploy: 'firebase deploy',
    gitAdd: 'git add src/ manifest.json .gitignore',
    gitCommit: (version, desc) => `git commit -m "Update ${version} - ${desc}"`,
    gitPush: 'git push origin main',
  }
};

module.exports = CoreConfig;
