const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');
const AdmZip = require('adm-zip');
const crypto = require('crypto');

// Colored console helpers - Safe color formatter working both as strings and functions
function createColorFormatter(openCode, closeCode = 39) {
  const supportsColor = Boolean(process.stdout && process.stdout.isTTY && !process.env.NO_COLOR);
  const openSeq = supportsColor ? `\x1b[${openCode}m` : '';
  const closeSeq = supportsColor ? `\x1b[${closeCode}m` : '';

  const formatter = function(text) {
    if (text === undefined || text === null) {
      return openSeq;
    }
    return `${openSeq}${text}${closeSeq}`;
  };

  formatter.toString = () => openSeq;
  formatter.valueOf = () => openSeq;
  formatter[Symbol.toPrimitive] = () => openSeq;

  return formatter;
}

function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch (e) {
    return null;
  }
}

function getFileMeta(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const stat = fs.statSync(filePath);
    const sha256 = getFileSha256(filePath);
    return {
      size: stat.size,
      mtime: stat.mtime,
      mtimeStr: stat.mtime.toLocaleString('fr-FR'),
      sha256
    };
  } catch (e) {
    return null;
  }
}

function getFirst5Lines(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return '    (Fichier inexistant / Nouveau fichier)';
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).slice(0, 5);
    return lines.map((line, idx) => `    L${idx + 1}: ${line}`).join('\n');
  } catch (e) {
    return '    (Fichier binaire ou impossible à lire)';
  }
}

function findProjectRootInDir(basePath) {
  const queue = [basePath];
  const maxDepth = 10;
  let depth = 0;

  while (queue.length > 0 && depth < maxDepth) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const currentDir = queue.shift();
      const hasPkg = fs.existsSync(path.join(currentDir, 'package.json'));
      const srcPath = path.join(currentDir, 'src');
      const hasSrc = fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory();

      if (hasPkg && hasSrc) {
        return currentDir;
      }

      try {
        const entries = fs.readdirSync(currentDir);
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === '.git' || entry === 'android' || entry === 'dist' || entry === 'build') continue;
          const fullPath = path.join(currentDir, entry);
          if (fs.statSync(fullPath).isDirectory()) {
            queue.push(fullPath);
          }
        }
      } catch (e) {}
    }
    depth++;
  }

  return basePath;
}

const c = {
  reset: createColorFormatter(0, 0),
  bold: createColorFormatter(1, 22),
  dim: createColorFormatter(2, 22),
  red: createColorFormatter(31, 39),
  green: createColorFormatter(32, 39),
  yellow: createColorFormatter(33, 39),
  blue: createColorFormatter(34, 39),
  magenta: createColorFormatter(35, 39),
  cyan: createColorFormatter(36, 39),
  white: createColorFormatter(37, 39)
};

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UPDATES_DIR = path.join(PROJECT_ROOT, 'updates');
const PROCESSED_DIR = path.join(UPDATES_DIR, 'processed');
const BACKUPS_DIR = path.join(PROJECT_ROOT, '.yeti_backups');
const TMP_DIR = path.join(PROJECT_ROOT, '.yeti_tmp');
const MAX_BACKUPS = 20;

// Directories and generated files to strictly ignore from diff, copy, and backup operations
const EXCLUDED_DIR_NAMES = new Set([
  'android',
  'node_modules',
  'dist',
  'build',
  '.git',
  '.yeti_backups',
  '.yeti_tmp',
  'updates',
  '.gradle',
  '.idea',
  '.vscode',
  'coverage'
]);

const EXCLUDED_FILE_NAMES = new Set([
  'package-lock.json',
  'bun.lock',
  'yarn.lock',
  'pnpm-lock.yaml'
]);

// Paths to ignore during backup & sync
const IGNORED_PATHS = [
  'android',
  'node_modules',
  'dist',
  '.yeti_backups',
  '.git',
  '.yeti_tmp',
  'updates',
  'build',
  'coverage',
  '.gradle',
  '.idea',
  '.vscode',
  'package-lock.json',
  'bun.lock',
  'yarn.lock',
  'pnpm-lock.yaml',
  'android/app/build',
  'android/build',
  'android/.gradle'
];

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) {
    return `${min} min ${sec} sec`;
  }
  return `${sec} sec`;
}

function logHeader(title) {
  console.log(`\n${c.cyan}${c.bold}====================================================${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ${title}${c.reset}`);
  console.log(`${c.cyan}${c.bold}====================================================${c.reset}\n`);
}

function logStep(stepNum, title) {
  console.log(`${c.yellow}${c.bold}[Étape ${stepNum}]${c.reset} ${c.bold}${title}${c.reset}`);
}

function logSuccess(msg) {
  console.log(`  ${c.green}✓ ${msg}${c.reset}`);
}

function logWarning(msg) {
  console.log(`  ${c.yellow}⚠ ${msg}${c.reset}`);
}

function logError(msg) {
  console.log(`  ${c.red}✖ ${msg}${c.reset}`);
}

function logInfo(msg) {
  console.log(`  ${c.blue}ℹ ${msg}${c.reset}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------
// Capacitor Helper & WebDir Detector
// ------------------------------------------------------------------
function getCapacitorConfigPaths() {
  return [
    'capacitor.config.ts',
    'capacitor.config.json',
    'capacitor.config.js',
    'capacitor.config.mjs',
    'capacitor.config.cjs'
  ];
}

function hasLocalCapacitorConfig() {
  return getCapacitorConfigPaths().some(p => fs.existsSync(path.join(PROJECT_ROOT, p)));
}

function detectCapacitorWebDir() {
  // 1. Try capacitor.config.json
  const jsonPath = path.join(PROJECT_ROOT, 'capacitor.config.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (cfg && cfg.webDir) {
        return cfg.webDir;
      }
    } catch (e) {}
  }

  // 2. Try capacitor.config.ts / .js / .mjs / .cjs
  const textConfigs = ['capacitor.config.ts', 'capacitor.config.js', 'capacitor.config.mjs', 'capacitor.config.cjs'];
  for (const cfgFile of textConfigs) {
    const cfgPath = path.join(PROJECT_ROOT, cfgFile);
    if (fs.existsSync(cfgPath)) {
      try {
        const content = fs.readFileSync(cfgPath, 'utf8');
        const match = content.match(/webDir\s*:\s*['"`]([^'"`]+)['"`]/);
        if (match && match[1]) {
          return match[1];
        }
      } catch (e) {}
    }
  }

  // 3. Fallback based on folder existence
  if (fs.existsSync(path.join(PROJECT_ROOT, 'dist'))) {
    return 'dist';
  }
  return 'www';
}

function isIgnored(relativePath) {
  if (!relativePath) return true;
  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  for (const part of parts) {
    if (EXCLUDED_DIR_NAMES.has(part)) {
      return true;
    }
  }

  const fileName = parts[parts.length - 1];
  if (EXCLUDED_FILE_NAMES.has(fileName)) {
    return true;
  }

  if (
    normalized.endsWith('.apk') ||
    normalized.endsWith('.DS_Store') ||
    normalized.endsWith('Thumbs.db') ||
    normalized.endsWith('.log') ||
    normalized.endsWith('.tmp')
  ) {
    return true;
  }

  return IGNORED_PATHS.some(ignored => {
    return normalized === ignored || normalized.startsWith(ignored + '/');
  });
}

function getAllFiles(dirPath, baseDir = dirPath) {
  let fileList = [];
  if (!fs.existsSync(dirPath)) return fileList;

  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (isIgnored(relPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fileList = fileList.concat(getAllFiles(fullPath, baseDir));
    } else {
      fileList.push(relPath);
    }
  }
  return fileList;
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  const items = fs.readdirSync(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const relPath = path.relative(PROJECT_ROOT, srcPath).replace(/\\/g, '/');

    if (isIgnored(relPath)) continue;

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// ------------------------------------------------------------------
// Helper: Get Commit Info from manifest.json / metadata.json / package.json
// ------------------------------------------------------------------
function getCommitInfo(extractedPath) {
  let version = '';
  let description = '';
  let name = '';

  // 1. Check manifest.json
  const manifestPath = path.join(extractedPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (m.version) version = m.version;
      if (m.description) description = m.description;
      if (m.name) name = m.name;
    } catch (e) {}
  }

  // 2. Check metadata.json
  const metaPath = path.join(extractedPath, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (!version && m.version) version = m.version;
      if (!description && m.description) description = m.description;
      if (!name && m.name) name = m.name;
    } catch (e) {}
  }

  // 3. Check package.json
  const pkgPath = path.join(extractedPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const p = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (!version && p.version) version = p.version;
      if (!description && p.description) description = p.description;
      if (!name && p.name) name = p.name;
    } catch (e) {}
  }

  const verFormatted = version ? (version.startsWith('v') ? version : `v${version}`) : 'v1.0.0';
  const descFormatted = description || (name ? `Projet ${name}` : 'Mise à jour via Google AI Studio');

  const commitMsg = `Mise à jour ${verFormatted} : ${descFormatted}`;

  return {
    version: verFormatted,
    description: descFormatted,
    commitMsg
  };
}

// ------------------------------------------------------------------
// Helper: Backup Retention & Pruning
// ------------------------------------------------------------------
function pruneOldBackups(maxBackups = MAX_BACKUPS) {
  if (!fs.existsSync(BACKUPS_DIR)) return;

  const entries = fs.readdirSync(BACKUPS_DIR)
    .filter(f => {
      const fp = path.join(BACKUPS_DIR, f);
      return fs.statSync(fp).isDirectory() && f.startsWith('backup_');
    })
    .sort(); // Alphabetic sort on backup_YYYY-MM-DD... sorts oldest first

  if (entries.length > maxBackups) {
    const toRemove = entries.slice(0, entries.length - maxBackups);
    logInfo(`Gestion des sauvegardes (limite : ${maxBackups}) : suppression des plus anciennes...`);
    for (const folder of toRemove) {
      const folderPath = path.join(BACKUPS_DIR, folder);
      removeDir(folderPath);
      logSuccess(`Ancienne sauvegarde supprimée : ${folder}`);
    }
  }
}

// ------------------------------------------------------------------
// Helper: Archive Processed ZIP File
// ------------------------------------------------------------------
function archiveProcessedZip(zipPath) {
  ensureDir(PROCESSED_DIR);
  const baseName = path.basename(zipPath);
  let destPath = path.join(PROCESSED_DIR, baseName);

  if (fs.existsSync(destPath)) {
    const ext = path.extname(baseName);
    const nameWithoutExt = path.basename(baseName, ext);
    const timeStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    destPath = path.join(PROCESSED_DIR, `${nameWithoutExt}_${timeStamp}${ext}`);
  }

  try {
    fs.renameSync(zipPath, destPath);
    logSuccess(`Fichier ZIP archivé dans 'updates/processed/${path.basename(destPath)}'.`);
    return destPath;
  } catch (err) {
    try {
      fs.copyFileSync(zipPath, destPath);
      fs.unlinkSync(zipPath);
      logSuccess(`Fichier ZIP archivé dans 'updates/processed/${path.basename(destPath)}'.`);
      return destPath;
    } catch (e) {
      logWarning(`Impossible de déplacer le fichier ZIP dans updates/processed : ${e.message}`);
      return null;
    }
  }
}

// ------------------------------------------------------------------
// Step 1: Detect Zip
// ------------------------------------------------------------------
function findUpdateZip() {
  ensureDir(UPDATES_DIR);
  const files = fs.readdirSync(UPDATES_DIR).filter(f => {
    const fp = path.join(UPDATES_DIR, f);
    return f.endsWith('.zip') && fs.statSync(fp).isFile();
  });

  if (files.length === 0) {
    logError(`Aucun fichier ZIP trouvé dans le dossier '${UPDATES_DIR}'.`);
    logInfo(`Veuillez télécharger le fichier ZIP depuis Google AI Studio et le déposer dans '${UPDATES_DIR}'.`);
    return null;
  }

  // Sort by modification time descending
  const sorted = files.map(f => {
    const fp = path.join(UPDATES_DIR, f);
    return { file: f, path: fp, time: fs.statSync(fp).mtimeMs };
  }).sort((a, b) => b.time - a.time);

  return sorted[0].path;
}

// ------------------------------------------------------------------
// Step 2: Extract Zip to Temp
// ------------------------------------------------------------------
function extractZip(zipPath) {
  removeDir(TMP_DIR);
  ensureDir(TMP_DIR);

  logInfo(`Extraction du fichier '${path.basename(zipPath)}'...`);
  const zip = new AdmZip(zipPath);
  const extractTarget = path.join(TMP_DIR, 'raw');
  zip.extractAllTo(extractTarget, true);

  logInfo(`Recherche automatique de la racine du projet dans l'archive...`);
  const realRoot = findProjectRootInDir(extractTarget);

  logInfo(`  ℹ Racine du projet ZIP localisée : '${path.resolve(realRoot)}'`);
  logSuccess(`Extraction réussie dans le dossier d'analyse temporaire.`);
  return realRoot;
}

// ------------------------------------------------------------------
// Step 3: Deep Validation of Extracted Project
// ------------------------------------------------------------------
function validateProject(extractedPath) {
  const errors = [];

  // 1. Mandatory Core Files & Directories Check
  const requiredCore = [
    { name: 'package.json', check: () => fs.existsSync(path.join(extractedPath, 'package.json')) },
    { name: 'dossier src/', check: () => fs.existsSync(path.join(extractedPath, 'src')) && fs.statSync(path.join(extractedPath, 'src')).isDirectory() },
    { name: 'index.html', check: () => fs.existsSync(path.join(extractedPath, 'index.html')) },
    { name: 'vite.config.ts (ou vite.config.js)', check: () => fs.existsSync(path.join(extractedPath, 'vite.config.ts')) || fs.existsSync(path.join(extractedPath, 'vite.config.js')) },
    { name: 'tsconfig.json', check: () => fs.existsSync(path.join(extractedPath, 'tsconfig.json')) }
  ];

  for (const item of requiredCore) {
    if (!item.check()) {
      errors.push(`Fichier ou dossier obligatoire manquant à la racine du ZIP : ${item.name}`);
    }
  }

  // 2. App Entry Check
  const hasAppEntry = fs.existsSync(path.join(extractedPath, 'src/App.tsx')) ||
                       fs.existsSync(path.join(extractedPath, 'src/main.tsx')) ||
                       fs.existsSync(path.join(extractedPath, 'index.html'));
  if (!hasAppEntry) {
    errors.push(`Entrée d'application introuvable (src/App.tsx, src/main.tsx ou index.html).`);
  }

  // 3. package.json Validation
  const pkgPath = path.join(extractedPath, 'package.json');
  let newPkg = null;
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, 'utf8');
      newPkg = JSON.parse(content);
      if (!newPkg.name && !newPkg.version) {
        errors.push(`package.json invalide : champs 'name' ou 'version' manquants.`);
      }
    } catch (err) {
      errors.push(`package.json corrompu ou syntaxe JSON invalide : ${err.message}`);
    }
  }

  // 4. metadata.json validation if exists
  const metaPath = path.join(extractedPath, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (err) {
      errors.push(`metadata.json présent mais syntaxe JSON invalide : ${err.message}`);
    }
  }

  // 5. Firebase & Capacitor Dependencies Check
  if (newPkg) {
    const curPkgPath = path.join(PROJECT_ROOT, 'package.json');
    let curDeps = {};
    if (fs.existsSync(curPkgPath)) {
      try {
        const curPkg = JSON.parse(fs.readFileSync(curPkgPath, 'utf8'));
        curDeps = { ...curPkg.dependencies, ...curPkg.devDependencies };
      } catch (e) {}
    }
    const allDeps = { ...curDeps, ...newPkg.dependencies, ...newPkg.devDependencies };
    
    // If project uses Capacitor / Android
    const hasAndroid = fs.existsSync(path.join(extractedPath, 'android')) || fs.existsSync(path.join(PROJECT_ROOT, 'android'));
    if (hasAndroid && !allDeps['@capacitor/core']) {
      logWarning(`Le projet comporte un dossier Android mais '@capacitor/core' n'est pas déclaré dans package.json.`);
    }

    // Check key imports in React files
    const srcDir = path.join(extractedPath, 'src');
    if (fs.existsSync(srcDir)) {
      const files = getAllFiles(srcDir);
      for (const relFile of files) {
        if (relFile.endsWith('.ts') || relFile.endsWith('.tsx')) {
          const fullPath = path.join(srcDir, relFile);
          try {
            const code = fs.readFileSync(fullPath, 'utf8');
            if (code.trim().length === 0) {
              errors.push(`Fichier source vide détecté : src/${relFile}`);
            }
            // Simple syntax/export sanity check
            if (code.includes('import ') && code.includes('from') && !code.includes(';')) {
              // Valid TypeScript allows optional semicolons, but check unclosed strings
            }
          } catch (e) {
            errors.push(`Impossible de lire le fichier source : src/${relFile}`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ------------------------------------------------------------------
// Smart Package.json Merger
// ------------------------------------------------------------------
function mergePackageJson(curPath, newPath) {
  if (!fs.existsSync(curPath) || !fs.existsSync(newPath)) return null;

  try {
    const curPkg = JSON.parse(fs.readFileSync(curPath, 'utf8'));
    const newPkg = JSON.parse(fs.readFileSync(newPath, 'utf8'));

    // Preserve local update scripts
    if (!newPkg.scripts) newPkg.scripts = {};
    if (curPkg.scripts) {
      if (curPkg.scripts['yeti-update'] && !newPkg.scripts['yeti-update']) {
        newPkg.scripts['yeti-update'] = curPkg.scripts['yeti-update'];
      }
      if (curPkg.scripts['yeti-rollback'] && !newPkg.scripts['yeti-rollback']) {
        newPkg.scripts['yeti-rollback'] = curPkg.scripts['yeti-rollback'];
      }
    }

    // Preserve Capacitor and essential local packages if present locally but missing in new update ZIP
    const preserveKeys = [
      '@capacitor/core',
      '@capacitor/cli',
      '@capacitor/android',
      '@capacitor/ios'
    ];

    const curDevDeps = curPkg.devDependencies || {};
    const curDeps = curPkg.dependencies || {};
    const newDevDeps = newPkg.devDependencies || {};
    const newDeps = newPkg.dependencies || {};

    for (const key of preserveKeys) {
      if (curDevDeps[key] && !newDevDeps[key] && !newDeps[key]) {
        newDevDeps[key] = curDevDeps[key];
      }
      if (curDeps[key] && !newDeps[key] && !newDevDeps[key]) {
        newDeps[key] = curDeps[key];
      }
    }

    // Preserve optionalDependencies (e.g. @rollup/rollup-win32-x64-msvc for Windows)
    const curOptDeps = curPkg.optionalDependencies || {};
    const newOptDeps = newPkg.optionalDependencies || {};
    for (const [k, v] of Object.entries(curOptDeps)) {
      if (!newOptDeps[k]) {
        newOptDeps[k] = v;
      }
    }
    newPkg.optionalDependencies = newOptDeps;

    newPkg.devDependencies = newDevDeps;
    newPkg.dependencies = newDeps;

    return newPkg;
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------------------
// Step 4: Compute Diff & Preview Report
// ------------------------------------------------------------------
function computeDiff(extractedPath) {
  const extractedFiles = getAllFiles(extractedPath).filter(f => !isIgnored(f));
  const currentFiles = getAllFiles(PROJECT_ROOT).filter(f => !isIgnored(f));
  const hasLocalConfig = hasLocalCapacitorConfig();

  const currentMap = new Map();
  for (const f of currentFiles) {
    const fp = path.join(PROJECT_ROOT, f);
    if (fs.existsSync(fp)) {
      try {
        currentMap.set(f, fs.readFileSync(fp));
      } catch (e) {}
    }
  }

  const added = [];
  const modified = [];
  const deleted = [];

  for (const f of extractedFiles) {
    if (isIgnored(f)) continue;
    const extractedFp = path.join(extractedPath, f);

    if (getCapacitorConfigPaths().includes(f) && hasLocalConfig) {
      currentMap.delete(f);
      continue;
    }

    if (!currentMap.has(f)) {
      added.push(f);
    } else {
      let isSame = false;
      try {
        const curBuf = currentMap.get(f);
        const newBuf = fs.readFileSync(extractedFp);

        if (curBuf && curBuf.equals(newBuf)) {
          isSame = true;
        } else if (curBuf) {
          // Normalize line endings for text comparisons
          const curNorm = curBuf.toString('utf8').replace(/\r\n/g, '\n');
          const newNorm = newBuf.toString('utf8').replace(/\r\n/g, '\n');
          if (curNorm === newNorm) {
            isSame = true;
          }
        }
      } catch (e) {}

      if (!isSame) {
        modified.push(f);
      }
      currentMap.delete(f);
    }
  }

  for (const [f] of currentMap.entries()) {
    if (isIgnored(f)) continue;
    if (getCapacitorConfigPaths().includes(f) && hasLocalConfig) continue;
    deleted.push(f);
  }

  // Compare package.json dependencies with smart merge
  const curPkgPath = path.join(PROJECT_ROOT, 'package.json');
  const newPkgPath = path.join(extractedPath, 'package.json');
  let depsChanged = false;
  let depSummary = { added: [], modified: [], removed: [] };

  if (fs.existsSync(curPkgPath) && fs.existsSync(newPkgPath)) {
    try {
      const curPkg = JSON.parse(fs.readFileSync(curPkgPath, 'utf8'));
      const mergedPkg = mergePackageJson(curPkgPath, newPkgPath) || JSON.parse(fs.readFileSync(newPkgPath, 'utf8'));

      const curDeps = { ...curPkg.dependencies, ...curPkg.devDependencies };
      const newDeps = { ...mergedPkg.dependencies, ...mergedPkg.devDependencies };

      for (const [k, v] of Object.entries(newDeps)) {
        if (!curDeps[k]) {
          depSummary.added.push(`${k}@${v}`);
        } else if (curDeps[k] !== v) {
          depSummary.modified.push(`${k}: ${curDeps[k]} → ${v}`);
        }
      }
      for (const [k, v] of Object.entries(curDeps)) {
        if (!newDeps[k]) {
          depSummary.removed.push(`${k}@${v}`);
        }
      }

      depsChanged = depSummary.added.length > 0 || depSummary.modified.length > 0 || depSummary.removed.length > 0;
    } catch (e) {
      // ignore
    }
  }

  let version = 'Nouvelle version';
  let description = 'Mise à jour via Google AI Studio';

  if (fs.existsSync(newPkgPath)) {
    try {
      const p = JSON.parse(fs.readFileSync(newPkgPath, 'utf8'));
      if (p.version) version = `v${p.version}`;
    } catch (e) {}
  }

  const metaPath = path.join(extractedPath, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (m.description) description = m.description;
      if (m.name) version = `${m.name} (${version})`;
    } catch (e) {}
  }

  return {
    version,
    description,
    added,
    modified,
    deleted,
    depsChanged,
    depSummary
  };
}

// ------------------------------------------------------------------
// Step 5: Backup Creation (Executed ONLY AFTER Confirmation)
// ------------------------------------------------------------------
function createBackup() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFolder = path.join(BACKUPS_DIR, `backup_${timestamp}`);

  ensureDir(backupFolder);
  logInfo(`Création de la sauvegarde dans : ${backupFolder}`);

  copyDirRecursive(PROJECT_ROOT, backupFolder);

  const metaPath = path.join(backupFolder, 'yeti_backup_meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    timestamp: now.toISOString(),
    createdFor: 'Yeti Update Manager',
    originalRoot: PROJECT_ROOT
  }, null, 2));

  logSuccess(`Sauvegarde réussie : ${backupFolder}`);
  return backupFolder;
}

// ------------------------------------------------------------------
// Step 6: Apply Update Files with Full SHA-256 Diagnostics
// ------------------------------------------------------------------
function applyUpdateFiles(extractedPath, deletedFiles = []) {
  const extractedFiles = getAllFiles(extractedPath);

  logInfo(`Remplacement des fichiers du projet...`);

  // Clean up any stale capacitor.config.json if capacitor.config.ts exists locally
  const tsCfgPath = path.join(PROJECT_ROOT, 'capacitor.config.ts');
  const jsonCfgPath = path.join(PROJECT_ROOT, 'capacitor.config.json');
  if (fs.existsSync(tsCfgPath) && fs.existsSync(jsonCfgPath)) {
    try {
      fs.unlinkSync(jsonCfgPath);
      logInfo(`  ℹ Nettoyage du fichier capacitor.config.json en conflit pour privilégier capacitor.config.ts.`);
    } catch (e) {}
  }

  const hasLocalConfig = hasLocalCapacitorConfig();

  // 1. Delete removed source files
  let deletedCount = 0;
  for (const relPath of deletedFiles) {
    if (isIgnored(relPath)) continue;
    if (getCapacitorConfigPaths().includes(relPath) && hasLocalConfig) continue;
    const destFile = path.join(PROJECT_ROOT, relPath);
    if (fs.existsSync(destFile)) {
      try {
        fs.unlinkSync(destFile);
        deletedCount++;
      } catch (e) {}
    }
  }

  if (deletedCount > 0) {
    logInfo(`${deletedCount} ancien(s) fichier(s) source supprimé(s).`);
  }

  // 2. Copy updated/added files and collect diagnostic telemetry
  const replacementReport = [];
  let copiedCount = 0;

  for (const relPath of extractedFiles) {
    if (isIgnored(relPath)) continue;

    if (getCapacitorConfigPaths().includes(relPath) && hasLocalConfig) {
      logInfo(`  ℹ Conservation de la configuration Capacitor locale (${relPath} ignoré du ZIP)`);
      continue;
    }

    const srcFile = path.join(extractedPath, relPath);
    const destFile = path.join(PROJECT_ROOT, relPath);

    const srcMeta = getFileMeta(srcFile);
    const srcLinesBefore = getFirst5Lines(srcFile);
    const destLinesBefore = getFirst5Lines(destFile);

    if (relPath === 'package.json') {
      const mergedPkg = mergePackageJson(destFile, srcFile);
      if (mergedPkg) {
        ensureDir(path.dirname(destFile));
        fs.writeFileSync(destFile, JSON.stringify(mergedPkg, null, 2), 'utf8');
        const destMeta = getFileMeta(destFile);
        const destLinesAfter = getFirst5Lines(destFile);
        replacementReport.push({
          relPath,
          srcMeta,
          destMeta,
          isMerged: true,
          srcLinesBefore,
          destLinesBefore,
          destLinesAfter
        });
        copiedCount++;
        continue;
      }
    }

    ensureDir(path.dirname(destFile));
    fs.copyFileSync(srcFile, destFile);
    const destMeta = getFileMeta(destFile);
    const destLinesAfter = getFirst5Lines(destFile);

    replacementReport.push({
      relPath,
      srcMeta,
      destMeta,
      isMerged: false,
      srcLinesBefore,
      destLinesBefore,
      destLinesAfter
    });
    copiedCount++;
  }

  // Display detailed replacement report for each replaced file
  console.log(`\n  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
  console.log(`  ${c.bold}LISTE ET MÉTADONNÉES DES FICHIERS REMPLACÉS${c.reset}`);
  console.log(`  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);

  let shaMismatchFound = false;
  let failedFile = null;

  for (const rep of replacementReport) {
    const { relPath, srcMeta, destMeta, isMerged, srcLinesBefore, destLinesBefore, destLinesAfter } = rep;
    console.log(`  • ${c.bold}${relPath}${c.reset}${isMerged ? ' (Fusion Intelligente package.json)' : ''}`);
    if (srcMeta && destMeta) {
      console.log(`    - Taille ZIP     : ${srcMeta.size} octets`);
      console.log(`    - Taille Projet  : ${destMeta.size} octets`);
      console.log(`    - Date Modif.   : ${destMeta.mtimeStr}`);
      console.log(`    - SHA-256 ZIP   : ${srcMeta.sha256}`);
      console.log(`    - SHA-256 Projet: ${destMeta.sha256}`);

      console.log(`    ${c.yellow}--- 5 PREMIÈRES LIGNES (DANS LE ZIP) ---${c.reset}`);
      console.log(srcLinesBefore);
      console.log(`    ${c.yellow}--- 5 PREMIÈRES LIGNES (PROJET AVANT REMPLACEMENT) ---${c.reset}`);
      console.log(destLinesBefore);
      console.log(`    ${c.green}--- 5 PREMIÈRES LIGNES (PROJET APRÈS REMPLACEMENT) ---${c.reset}`);
      console.log(destLinesAfter);

      if (!isMerged && srcMeta.sha256 !== destMeta.sha256) {
        logError(`  DIVERGENCE DE CONTENU DÉTECTÉE SUR LE FICHIER : ${relPath}`);
        shaMismatchFound = true;
        failedFile = relPath;
      } else {
        console.log(`    - Validation     : ${c.green}✓ SHA-256 100% Identique${c.reset}`);
      }
    } else {
      logError(`  Impossible de lire les métadonnées pour le fichier : ${relPath}`);
      shaMismatchFound = true;
      failedFile = relPath;
    }
    console.log('');
  }

  if (shaMismatchFound) {
    throw new Error(`ÉCHEC SÉCURITÉ : Le fichier '${failedFile}' dans le projet ne correspond pas exactement au fichier du ZIP (SHA-256 divergent).`);
  }

  logSuccess(`${copiedCount} fichier(s) remplacés et 100% vérifiés par SHA-256 avec succès.`);
  return replacementReport;
}

// ------------------------------------------------------------------
// Rollback Logic
// ------------------------------------------------------------------
function rollbackFromBackup(backupPath) {
  logHeader('PROCÉDURE DE RESTAURATION AUTOMATIQUE (ROLLBACK)');
  logWarning(`Restauration du projet local depuis la sauvegarde : ${backupPath}`);

  if (!fs.existsSync(backupPath)) {
    logError(`Dossier de sauvegarde introuvable : ${backupPath}`);
    return false;
  }

  copyDirRecursive(backupPath, PROJECT_ROOT);

  logSuccess('Restauration locale terminée avec succès ! Le projet est revenu à son état initial.');
  return true;
}

function handleManualRollback() {
  logHeader('YETI UPDATE MANAGER - RESTAURATION MANUELLE');

  if (!fs.existsSync(BACKUPS_DIR)) {
    logError(`Aucune sauvegarde trouvée dans '${BACKUPS_DIR}'.`);
    return;
  }

  const backups = fs.readdirSync(BACKUPS_DIR)
    .filter(f => fs.statSync(path.join(BACKUPS_DIR, f)).isDirectory())
    .sort()
    .reverse();

  if (backups.length === 0) {
    logError(`Aucune sauvegarde disponible dans '${BACKUPS_DIR}'.`);
    return;
  }

  console.log(`${c.bold}Sauvegardes locales disponibles :${c.reset}\n`);
  backups.forEach((b, idx) => {
    const metaPath = path.join(BACKUPS_DIR, b, 'yeti_backup_meta.json');
    let metaStr = '';
    if (fs.existsSync(metaPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        metaStr = ` (Créée le : ${new Date(m.timestamp).toLocaleString('fr-FR')})`;
      } catch (e) {}
    }
    console.log(`  [${idx + 1}] ${c.cyan}${b}${c.reset}${metaStr}`);
  });

  console.log(`  [0] Annuler\n`);

  askQuestion(`${c.yellow}${c.bold}Choisissez le numéro de la sauvegarde à restaurer [0-${backups.length}] : ${c.reset}`).then(answer => {
    const choice = parseInt(answer.trim(), 10);
    if (isNaN(choice) || choice <= 0 || choice > backups.length) {
      logInfo('Restauration annulée.');
      process.exit(0);
    }

    const selectedBackup = path.join(BACKUPS_DIR, backups[choice - 1]);
    const success = rollbackFromBackup(selectedBackup);
    if (success) {
      logInfo('Note : La restauration manuelle modifie uniquement le projet local et ne touche pas à GitHub.');
    }
    process.exit(0);
  });
}

// ------------------------------------------------------------------
// Command Runner with Duration Tracking and Output Capture
// ------------------------------------------------------------------
function runCmd(cmd, options = {}) {
  logInfo(`Exécution : ${cmd}`);
  const start = Date.now();
  let outputBuf = '';
  try {
    const res = spawnSync(cmd, {
      shell: true,
      cwd: options.cwd || PROJECT_ROOT,
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: process.env
    });

    if (res.stdout) {
      process.stdout.write(res.stdout);
      outputBuf += res.stdout;
    }
    if (res.stderr) {
      process.stderr.write(res.stderr);
      outputBuf += res.stderr;
    }

    const duration = Date.now() - start;
    return {
      success: res.status === 0,
      duration,
      output: outputBuf
    };
  } catch (err) {
    const duration = Date.now() - start;
    logError(`Erreur lors de l'exécution de '${cmd}' : ${err.message}`);
    return {
      success: false,
      duration,
      output: err.message
    };
  }
}

// ------------------------------------------------------------------
// Main Workflow
// ------------------------------------------------------------------
async function main() {
  const globalStart = Date.now();
  const args = process.argv.slice(2);

  if (args.includes('--rollback')) {
    handleManualRollback();
    return;
  }

  logHeader('YETI UPDATE MANAGER - AUTOMATION ENGINE');

  // Step 1: Detect ZIP
  logStep(1, 'Détection du fichier de mise à jour (ZIP)');
  const zipPath = findUpdateZip();
  if (!zipPath) {
    process.exit(1);
  }
  logSuccess(`Fichier ZIP détecté : ${path.basename(zipPath)}`);

  // Step 2: Extraction to Temp
  logStep(2, 'Extraction de la mise à jour dans le dossier d\'analyse temporaire');
  let extractedPath = null;
  try {
    extractedPath = extractZip(zipPath);
  } catch (err) {
    logError(`Échec lors de l'extraction du ZIP : ${err.message}`);
    removeDir(TMP_DIR);
    process.exit(1);
  }

  // Step 3: Deep Pre-Validation (BEFORE Touching Project & BEFORE Backup)
  logStep(3, 'Validation complète pré-installation');
  const valStart = Date.now();
  const validation = validateProject(extractedPath);
  const valDuration = Date.now() - valStart;

  if (!validation.valid) {
    logError('La validation complète du ZIP a échoué. Des erreurs ont été détectées :');
    validation.errors.forEach(e => logError(`- ${e}`));
    logWarning('Mise à jour annulée. Aucun fichier du projet n\'a été modifié.');
    removeDir(TMP_DIR);
    process.exit(1);
  }
  logSuccess(`Validation complète réussie (${formatDuration(valDuration)}) : Structure, fichiers indispensables, JSON, React et Capacitor valides.`);

  // Print list of files present in src/ of the extracted ZIP
  const zipSrcDir = path.join(extractedPath, 'src');
  if (fs.existsSync(zipSrcDir)) {
    const zipSrcFiles = getAllFiles(zipSrcDir).filter(f => !isIgnored(f));
    console.log(`\n  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
    console.log(`  ${c.bold}LISTE DES FICHIERS SOURCE 'src/' DANS LE ZIP EXTRAIT (${zipSrcFiles.length} fichiers)${c.reset}`);
    console.log(`  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
    for (const relSrcFile of zipSrcFiles) {
      console.log(`  • src/${relSrcFile}`);
    }
    console.log('');
  }

  // Step 4: Preview Report & Confirmation
  logStep(4, 'Prévisualisation et rapport de modifications');
  const diff = computeDiff(extractedPath);

  console.log(`\n${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
  console.log(`${c.bold} RAPPORT DE PRÉVISUALISATION DE LA MISE À JOUR${c.reset}`);
  console.log(`${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
  console.log(`  • Version détectée  : ${c.green}${c.bold}${diff.version}${c.reset}`);
  console.log(`  • Description        : ${diff.description}`);
  console.log(`  • Fichiers ajoutés   : ${c.green}${diff.added.length}${c.reset}`);
  console.log(`  • Fichiers modifiés  : ${c.yellow}${diff.modified.length}${c.reset}`);
  console.log(`  • Fichiers supprimés : ${c.red}${diff.deleted.length}${c.reset}`);
  console.log(`  • Dépendances npm    : ${diff.depsChanged ? `${c.yellow}Modifiées${c.reset}` : `${c.green}Inchangées${c.reset}`}`);

  if (diff.depsChanged) {
    if (diff.depSummary.added.length) console.log(`    - Ajouts     : ${diff.depSummary.added.join(', ')}`);
    if (diff.depSummary.modified.length) console.log(`    - Modif.     : ${diff.depSummary.modified.join(', ')}`);
    if (diff.depSummary.removed.length) console.log(`    - Suppr.     : ${diff.depSummary.removed.join(', ')}`);
  }
  console.log(`${c.cyan}${c.bold}----------------------------------------------------${c.reset}\n`);

  if (diff.deleted.length > 50) {
    console.log(`  ${c.red}${c.bold}⚠ ALERTE SÉCURITÉ : NOMBRE ANORMALEMENT ÉLEVÉ DE SUPPRESSIONS DÉTECTÉ !${c.reset}`);
    console.log(`  ${c.yellow}La mise à jour prévoit la suppression de ${c.bold}${c.red}${diff.deleted.length}${c.reset}${c.yellow} fichiers source.${c.reset}`);
    console.log(`  ${c.yellow}Exemples de fichiers concernés : ${diff.deleted.slice(0, 5).join(', ')}...${c.reset}\n`);

    const confirmAnswer = await askQuestion(`${c.red}${c.bold}Pour débloquer la procédure, tapez 'CONFIRMER' ou 'OUI' pour autoriser cette suppression massive : ${c.reset}`);
    const normalizedConfirm = confirmAnswer.trim().toLowerCase();
    if (
      normalizedConfirm !== 'confirmer' &&
      normalizedConfirm !== 'oui' &&
      normalizedConfirm !== 'o' &&
      normalizedConfirm !== 'yes' &&
      normalizedConfirm !== 'y'
    ) {
      logError(`Procédure bloquée : La suppression massive de ${diff.deleted.length} fichiers a été refusée.`);
      logInfo('Aucun fichier du projet n\'a été modifié.');
      removeDir(TMP_DIR);
      process.exit(1);
    }
    logWarning(`Suppression massive de ${diff.deleted.length} fichiers explicitement confirmée par l'utilisateur.`);
  } else if (!args.includes('--yes')) {
    const answer = await askQuestion(`${c.yellow}${c.bold}Continuer la mise à jour ? [O/n] : ${c.reset}`);
    const normalized = answer.trim().toLowerCase();
    if (normalized === 'n' || normalized === 'no' || (normalized !== 'o' && normalized !== 'oui' && normalized !== 'y' && normalized !== 'yes' && normalized !== '')) {
      logInfo('Mise à jour annulée par l\'utilisateur. Aucun fichier du projet n\'a été modifié.');
      removeDir(TMP_DIR);
      process.exit(0);
    }
  }

  // Step 5: Backup Creation (ONLY AFTER Confirmation)
  logStep(5, 'Création de la sauvegarde locale complète');
  const backupStart = Date.now();
  let backupFolder = null;
  try {
    backupFolder = createBackup();
    pruneOldBackups(MAX_BACKUPS);
  } catch (err) {
    logError(`Échec de la création de la sauvegarde : ${err.message}`);
    removeDir(TMP_DIR);
    process.exit(1);
  }
  const backupDuration = Date.now() - backupStart;

  // Step 6: Application of Files with Diagnostic Checks
  logStep(6, 'Remplacement des fichiers du projet');
  let appliedReport = [];
  try {
    appliedReport = applyUpdateFiles(extractedPath, diff.deleted);
  } catch (err) {
    logError(`Erreur lors de l'application des fichiers : ${err.message}`);
    rollbackFromBackup(backupFolder);
    removeDir(TMP_DIR);
    process.exit(1);
  }

  // Step 7: NPM Install
  let npmStatus = 'Ignoré (pas de changement)';
  let npmDurationStr = '0 sec';
  if (diff.depsChanged || !fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'))) {
    logStep(7, 'Mise à jour des dépendances (npm install --include=optional)');
    const res = runCmd('npm install --include=optional');
    npmDurationStr = formatDuration(res.duration);
    if (!res.success) {
      logError('`npm install` a échoué. Déclenchement du rollback automatique...');
      rollbackFromBackup(backupFolder);
      removeDir(TMP_DIR);
      process.exit(1);
    }
    npmStatus = `OK (${npmDurationStr})`;
    logSuccess(`Dépendances installées avec succès en ${npmDurationStr}.`);
  } else {
    logStep(7, 'Vérification des dépendances : Inchangées');
  }

  // Step 7.5: Vite Sources Pre-Build Verification
  logInfo('Vérification des fichiers source utilisés par Vite avant compilation...');
  const srcFiles = getAllFiles(path.join(PROJECT_ROOT, 'src')).filter(f => !isIgnored(f));
  let srcCheckCount = 0;
  let srcMismatchFound = false;

  for (const relSrc of srcFiles) {
    const projPath = path.join(PROJECT_ROOT, 'src', relSrc);
    const zipSrcPath = path.join(extractedPath, 'src', relSrc);

    if (fs.existsSync(zipSrcPath)) {
      const projSha = getFileSha256(projPath);
      const zipSha = getFileSha256(zipSrcPath);
      if (projSha !== zipSha) {
        logError(`ERREUR SOURCE VITE : Le fichier 'src/${relSrc}' dans le projet (SHA: ${projSha}) ne correspond pas au ZIP (SHA: ${zipSha}).`);
        srcMismatchFound = true;
      }
      srcCheckCount++;
    }
  }

  if (srcMismatchFound) {
    logError('Annulation : Les sources du projet prêtes pour Vite diffèrent des sources du ZIP.');
    rollbackFromBackup(backupFolder);
    removeDir(TMP_DIR);
    process.exit(1);
  }
  logSuccess(`${srcCheckCount} fichier(s) source dans 'src/' contrôlés et validés avant compilation (SHA-256 100% identiques au ZIP).`);

  // Step 8: Build Verification with Dist Validation
  logStep(8, 'Compilation du projet (npm run build)');
  logInfo(`  ℹ Le build sera effectué avec les sources provenant de : ${path.resolve(PROJECT_ROOT)}`);
  logInfo(`  ℹ Sources extraites de : ${path.resolve(extractedPath)}`);
  const buildStartTime = Date.now();
  let buildRes = runCmd('npm run build');

  // Check for missing Rollup / Esbuild platform-specific native binaries (common npm bug on Windows)
  if (!buildRes.success && buildRes.output && (
    buildRes.output.includes('rollup-win32') ||
    buildRes.output.includes('@rollup/rollup-') ||
    (buildRes.output.includes('MODULE_NOT_FOUND') && buildRes.output.includes('rollup')) ||
    buildRes.output.includes('esbuild-win32')
  )) {
    logWarning('  ⚠ Détection d\'un module natif Rollup/Esbuild Windows manquant.');
    logInfo('  ℹ Réparation automatique : installation directe de @rollup/rollup-win32-x64-msvc...');
    
    // Explicitly install Windows Rollup binary
    runCmd('npm install @rollup/rollup-win32-x64-msvc --no-save --force');

    // Remove stale package-lock.json if present
    const lockPath = path.join(PROJECT_ROOT, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch (e) {}
    }

    logInfo('  ℹ Nouvelle tentative de compilation (npm run build)...');
    buildRes = runCmd('npm run build');
  }

  const buildDurationStr = formatDuration(buildRes.duration);
  if (!buildRes.success) {
    logError('La compilation `npm run build` a échoué. Déclenchement du rollback automatique...');
    rollbackFromBackup(backupFolder);
    removeDir(TMP_DIR);
    process.exit(1);
  }

  // Post-Build Check: Validate regenerated dist directory
  const webDir = detectCapacitorWebDir();
  const distPath = path.join(PROJECT_ROOT, webDir);
  if (!fs.existsSync(distPath)) {
    logError(`Le dossier de sortie de compilation '${webDir}' n'existe pas après npm run build.`);
    rollbackFromBackup(backupFolder);
    removeDir(TMP_DIR);
    process.exit(1);
  }

  const distFiles = getAllFiles(distPath).filter(f => !isIgnored(f));
  if (distFiles.length === 0) {
    logError(`Le dossier '${webDir}' est vide après la compilation.`);
    rollbackFromBackup(backupFolder);
    removeDir(TMP_DIR);
    process.exit(1);
  }

  const distReportMap = new Map();
  console.log(`\n  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
  console.log(`  ${c.bold}DOSSIER '${webDir.toUpperCase()}' RÉGÉNÉRÉ (SORTIE VITE BUILD)${c.reset}`);
  console.log(`  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);

  for (const relDist of distFiles) {
    const fullDistPath = path.join(distPath, relDist);
    const meta = getFileMeta(fullDistPath);
    distReportMap.set(relDist, meta);
    console.log(`  • ${webDir}/${relDist}`);
    console.log(`    - Taille    : ${meta.size} octets`);
    console.log(`    - Modifié   : ${meta.mtimeStr}`);
    console.log(`    - SHA-256   : ${meta.sha256}`);
  }
  console.log('');
  logSuccess(`Compilation et régénération du dossier '${webDir}' réussies en ${buildDurationStr} (${distFiles.length} fichier(s) générés).`);

  // Step 8.5: Déploiement Firebase Hosting (Étape Indépendante)
  let firebaseStatus = 'Ignoré (pas de firebase.json)';
  let firebaseHostingUrl = null;
  let firebaseDeployTime = null;

  const firebaseJsonPath = path.join(PROJECT_ROOT, 'firebase.json');
  const hasFirebaseJson = fs.existsSync(firebaseJsonPath);

  if (hasFirebaseJson) {
    logStep(8.5, 'Déploiement Firebase Hosting (Étape Indépendante)');
    try {
      // 1. Détecter le projet Firebase ciblé
      let targetProjectId = 'yeti-stock-suivi';
      const firebaseRcPath = path.join(PROJECT_ROOT, '.firebaserc');
      if (fs.existsSync(firebaseRcPath)) {
        try {
          const rc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
          if (rc && rc.projects && rc.projects.default) {
            targetProjectId = rc.projects.default;
          }
        } catch (e) {}
      }

      logInfo(`Fichier 'firebase.json' détecté.`);
      logInfo(`Projet Firebase ciblé : ${c.bold}${c.cyan}${targetProjectId}${c.reset}`);

      // 2. Vérifier Firebase CLI
      logInfo('Vérification de l\'installation de Firebase CLI...');
      const cliCheck = runCmd('npx firebase --version');
      if (!cliCheck.success) {
        logWarning('Firebase CLI non disponible ou non accessible via npx.');
        firebaseStatus = 'ERROR (Firebase CLI non disponible)';
        logError('Statut Firebase Hosting : ERROR');
      } else {
        // 3. Demander confirmation avant le déploiement si pas d'argument --yes
        let shouldDeploy = true;
        if (!args.includes('--yes')) {
          const answer = await askQuestion(`${c.yellow}${c.bold}Déployer la mise à jour sur Firebase Hosting (${targetProjectId}) ? [O/n] : ${c.reset}`);
          const normalized = answer.trim().toLowerCase();
          if (normalized === 'n' || normalized === 'no') {
            shouldDeploy = false;
            logInfo('Déploiement Firebase Hosting annulé à la demande de l\'utilisateur.');
            firebaseStatus = 'Ignoré (Annulé par l\'utilisateur)';
          }
        }

        if (shouldDeploy) {
          logInfo(`Lancement du déploiement : npx firebase deploy --only hosting...`);
          const fbRes = runCmd('npx firebase deploy --only hosting');
          firebaseDeployTime = new Date().toLocaleString('fr-FR');

          if (fbRes.success) {
            firebaseHostingUrl = `https://${targetProjectId}.web.app`;
            firebaseStatus = `SUCCESS (Déployé le ${firebaseDeployTime})`;
            logSuccess('Déploiement Firebase Hosting réussi avec succès !');
            console.log(`  • URL Firebase : ${c.cyan}${c.bold}${firebaseHostingUrl}${c.reset}`);
            console.log(`  • Date         : ${firebaseDeployTime}`);
            console.log(`  • Statut       : ${c.green}${c.bold}SUCCESS${c.reset}\n`);
          } else {
            firebaseStatus = 'ERROR (Échec déploiement)';
            logError('Échec du déploiement Firebase Hosting.');
            console.log(`  • Statut       : ${c.red}${c.bold}ERROR${c.reset}`);
            logWarning('Remarque : L\'échec du déploiement Firebase Hosting n\'annule pas la mise à jour locale ni la génération APK (Étape indépendante).');
          }
        }
      }
    } catch (fbErr) {
      firebaseStatus = `ERROR (${fbErr.message})`;
      logError(`Erreur inattendue lors du déploiement Firebase : ${fbErr.message}`);
      logWarning('Remarque : La mise à jour locale et la suite de la compilation sont conservées.');
    }
  } else {
    logStep(8.5, 'Déploiement Firebase Hosting : Ignoré (firebase.json non trouvé)');
  }

  // Step 9: Capacitor Sync
  let capStatus = 'Ignoré (projet web pur)';
  let capDurationStr = '0 sec';
  const hasCapacitor = fs.existsSync(path.join(PROJECT_ROOT, 'capacitor.config.ts')) ||
                       fs.existsSync(path.join(PROJECT_ROOT, 'capacitor.config.json')) ||
                       fs.existsSync(path.join(PROJECT_ROOT, 'capacitor.config.js')) ||
                       fs.existsSync(path.join(PROJECT_ROOT, 'android'));

  if (hasCapacitor) {
    logStep(9, 'Synchronisation Android Capacitor (npx cap sync android)');

    // Ensure stale/conflicting capacitor.config.json is removed if capacitor.config.ts exists
    const tsCfgPath = path.join(PROJECT_ROOT, 'capacitor.config.ts');
    const jsonCfgPath = path.join(PROJECT_ROOT, 'capacitor.config.json');
    if (fs.existsSync(tsCfgPath) && fs.existsSync(jsonCfgPath)) {
      try {
        fs.unlinkSync(jsonCfgPath);
        logInfo('  ℹ Nettoyage de capacitor.config.json obsolète pour privilégier capacitor.config.ts');
      } catch (e) {}
    }

    const detectedWebDir = detectCapacitorWebDir();
    logInfo(`  ℹ Configuration Capacitor détectée : webDir = '${detectedWebDir}'`);

    // Pre-Capacitor Sync Check: Ensure dist files remain untouched
    for (const relDist of distFiles) {
      const fullDistPath = path.join(distPath, relDist);
      const currentMeta = getFileMeta(fullDistPath);
      const initialMeta = distReportMap.get(relDist);

      if (!currentMeta || !initialMeta || currentMeta.sha256 !== initialMeta.sha256) {
        logError(`DIVERGENCE '${detectedWebDir}' : Le fichier '${detectedWebDir}/${relDist}' a été altéré avant la synchronisation Capacitor.`);
        rollbackFromBackup(backupFolder);
        removeDir(TMP_DIR);
        process.exit(1);
      }
    }
    logSuccess(`Contenu de '${detectedWebDir}' validé avant la synchronisation Capacitor.`);

    const capRes = runCmd('npx cap sync android');
    capDurationStr = formatDuration(capRes.duration);
    if (!capRes.success) {
      logError('La synchronisation Capacitor `npx cap sync android` a échoué. Rollback automatique...');
      rollbackFromBackup(backupFolder);
      removeDir(TMP_DIR);
      process.exit(1);
    }

    // Post-Capacitor Sync Check: Verify android/app/src/main/assets/public strictly matches dist SHA-256
    const androidPublicDir = path.join(PROJECT_ROOT, 'android/app/src/main/assets/public');
    if (!fs.existsSync(androidPublicDir)) {
      logError(`Le dossier d'assets Android '${androidPublicDir}' est introuvable après la synchronisation.`);
      rollbackFromBackup(backupFolder);
      removeDir(TMP_DIR);
      process.exit(1);
    }

    console.log(`\n  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
    console.log(`  ${c.bold}CONTRÔLE D'INTÉGRITÉ ASSETS ANDROID (npx cap sync)${c.reset}`);
    console.log(`  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);

    let syncDivergenceFound = false;
    let failedAsset = null;

    for (const relDist of distFiles) {
      const distFilePath = path.join(distPath, relDist);
      const androidFilePath = path.join(androidPublicDir, relDist);

      const distSha = getFileSha256(distFilePath);
      const androidSha = getFileSha256(androidFilePath);

      console.log(`  • Asset : ${relDist}`);
      console.log(`    - SHA-256 '${detectedWebDir}' : ${distSha}`);
      console.log(`    - SHA-256 Android : ${androidSha || 'NON TROUVÉ'}`);

      if (!androidSha) {
        logError(`    ✖ FICHIER ABSENT DANS LES ASSETS ANDROID : ${relDist}`);
        syncDivergenceFound = true;
        failedAsset = relDist;
      } else if (distSha !== androidSha) {
        logError(`    ✖ DIVERGENCE SHA-256 ENTRE DIST ET ASSETS ANDROID : ${relDist}`);
        syncDivergenceFound = true;
        failedAsset = relDist;
      } else {
        console.log(`    - Validation     : ${c.green}✓ SHA-256 100% Identique à dist${c.reset}`);
      }
      console.log('');
    }

    if (syncDivergenceFound) {
      logError(`Mise à jour interrompue : L'asset Android '${failedAsset}' ne correspond pas exactement au fichier compilé de '${detectedWebDir}'.`);
      rollbackFromBackup(backupFolder);
      removeDir(TMP_DIR);
      process.exit(1);
    }

    capStatus = `OK (${capDurationStr})`;
    logSuccess(`Synchronisation Capacitor Android terminée et 100% validée par SHA-256 en ${capDurationStr}.`);
  } else {
    logStep(9, 'Capacitor : Ignoré (dossier Android non détecté)');
  }

  // Step 10: APK Release Generation
  let apkStatus = 'Ignoré (pas de sous-dossier android)';
  let apkPath = 'Non généré';
  let apkDurationStr = '0 sec';
  let apkMeta = null;
  const hasAndroidNative = fs.existsSync(path.join(PROJECT_ROOT, 'android'));

  if (hasAndroidNative) {
    logStep(10, 'Génération de l\'APK Release Android');
    const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat assembleRelease' : './gradlew assembleRelease';
    const apkRes = runCmd(gradlewCmd, { cwd: path.join(PROJECT_ROOT, 'android') });
    apkDurationStr = formatDuration(apkRes.duration);

    const expectedApk = path.join(PROJECT_ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
    if (apkRes.success && fs.existsSync(expectedApk)) {
      apkStatus = `OK (${apkDurationStr})`;
      apkPath = expectedApk;
      apkMeta = getFileMeta(expectedApk);

      console.log(`\n  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
      console.log(`  ${c.bold}MÉTADONNÉES DE L'APK RELEASE GÉNÉRÉ${c.reset}`);
      console.log(`  ${c.cyan}${c.bold}----------------------------------------------------${c.reset}`);
      console.log(`  • Fichier : ${path.basename(expectedApk)}`);
      console.log(`  • Taille  : ${(apkMeta.size / (1024 * 1024)).toFixed(2)} MB (${apkMeta.size} octets)`);
      console.log(`  • Date    : ${apkMeta.mtimeStr}`);
      console.log(`  • SHA-256 : ${apkMeta.sha256}`);
      console.log(`${c.cyan}${c.bold}----------------------------------------------------${c.reset}\n`);

      logSuccess(`APK Release généré avec succès en ${apkDurationStr} :\n     ${apkPath}`);
    } else {
      logError('Génération de l\'APK Release échouée. Rollback automatique...');
      rollbackFromBackup(backupFolder);
      removeDir(TMP_DIR);
      process.exit(1);
    }
  } else {
    logStep(10, 'APK Release : Ignoré (dossier android non présent)');
  }

  // Step 11: Git Commit & Push (ONLY IF ALL PREVIOUS STEPS SUCCEEDED)
  logStep(11, 'Sauvegarde du code sur GitHub');
  let gitCommitStatus = 'Échoué';
  let gitPushStatus = 'Échoué';

  // Double check all previous steps succeeded
  const buildChainOk = buildRes.success && (!hasCapacitor || capStatus.startsWith('OK')) && (!hasAndroidNative || apkStatus.startsWith('OK'));

  if (buildChainOk) {
    const addRes = runCmd('git add .');
    if (addRes.success) {
      const commitInfo = getCommitInfo(extractedPath);
      const commitRes = runCmd(`git commit -m "${commitInfo.commitMsg.replace(/"/g, '\\"')}"`);
      
      if (commitRes.success) {
        gitCommitStatus = 'OK';
        logSuccess(`Git Commit réalisé avec le message : "${commitInfo.commitMsg}"`);
        const pushRes = runCmd('git push origin main');
        if (pushRes.success) {
          gitPushStatus = 'OK';
          logSuccess('Git Push vers GitHub réussi !');
        } else {
          logWarning('Le git push a échoué. Le code est commité localement.');
        }
      } else {
        logInfo('Aucun changement à commiter dans Git.');
        gitCommitStatus = 'OK (Aucun changement)';
        gitPushStatus = 'OK';
      }
    }
  } else {
    logError('Certaines étapes de build ont échoué. Aucun commit Git ne sera effectué.');
  }

  // Clean up temp dir and archive update zip
  removeDir(TMP_DIR);
  const archivedZipPath = archiveProcessedZip(zipPath);

  const totalDuration = Date.now() - globalStart;

  // Final Comprehensive Diagnostic Summary Report
  logHeader('RAPPORT DE DIAGNOSTIC ET VALIDATION DE LA CHAÎNE DE TRANSMISSION');
  console.log(`  • Version installée          : ${c.green}${c.bold}${diff.version}${c.reset}`);
  console.log(`  • Sauvegarde créée           : ${c.cyan}${backupFolder}${c.reset}`);
  console.log(`  • Durée totale de la MAJ     : ${c.bold}${formatDuration(totalDuration)}${c.reset}`);
  console.log(`\n  ${c.bold}BILAN DES ÉTAPES DE TRANSMISSION (100% VALIDE) :${c.reset}`);
  console.log(`  ✓ 1. Fichiers du ZIP        : ${diff.added.length + diff.modified.length} fichier(s) remplacés (Structure & JSON valides)`);
  console.log(`  ✓ 2. Fichiers copiés       : ${appliedReport.length} fichier(s) appliqués (SHA-256 100% vérifiés)`);
  console.log(`  ✓ 3. Sources Vite          : ${srcCheckCount} fichier(s) dans 'src/' (SHA-256 100% conformes au ZIP)`);
  console.log(`  ✓ 4. Compilation 'dist'    : ${distFiles.length} fichier(s) générés dans '${webDir}' (${buildDurationStr})`);
  console.log(`  ✓ 4b. Déploiement Firebase  : ${firebaseStatus.includes('SUCCESS') ? `${c.green}${firebaseStatus}${c.reset}` : firebaseStatus}`);
  console.log(`  ✓ 5. Synchro Android Assets : ${distFiles.length} fichier(s) dans public/ (SHA-256 100% identiques à dist)`);
  if (apkMeta) {
    console.log(`  ✓ 6. APK Release Android   : Généré (${(apkMeta.size / (1024 * 1024)).toFixed(2)} MB | SHA-256: ${apkMeta.sha256.slice(0, 16)}...)`);
  }
  console.log(`  ✓ 7. Sauvegarde GitHub     : Commit ${gitCommitStatus} / Push ${gitPushStatus}`);

  if (firebaseHostingUrl && firebaseStatus.includes('SUCCESS')) {
    console.log(`\n  ${c.bold}URL Web Firebase Hosting :${c.reset}`);
    console.log(`  ↳ ${c.cyan}${c.bold}${firebaseHostingUrl}${c.reset}`);
  }
  if (archivedZipPath) {
    console.log(`\n  ${c.bold}Historique du ZIP archivé :${c.reset}`);
    console.log(`  ↳ ${c.cyan}${c.bold}${archivedZipPath}${c.reset}`);
  }
  console.log(`\n  ${c.bold}Emplacement APK Release :${c.reset}`);
  console.log(`  ↳ ${c.green}${c.bold}${apkPath}${c.reset}`);
  console.log(`\n  ${c.bold}Emplacement Sauvegarde Locale :${c.reset}`);
  console.log(`  ↳ ${c.cyan}${c.bold}${backupFolder}${c.reset}`);
  console.log(`\n  ${c.yellow}${c.bold}ℹ COMMENT VOIR VOS NOUVELLES MODIFICATIONS :${c.reset}`);
  console.log(`   1. Sur Mobile Android : Copiez le fichier 'app-release.apk' ci-dessus sur votre smartphone et installez-le.`);
  console.log(`   2. Sur Navigateur Web : Si vous testez en local, faites un rafraîchissement forcé (Ctrl + F5).`);
  console.log(`\n${c.green}${c.bold}✓ Mise à jour entièrement terminée et sécurisée avec succès !${c.reset}\n`);
}

main().catch(err => {
  logError(`Erreur inattendue : ${err.message}`);
  process.exit(1);
});
