// Local Gradle builds for Android, per profile.
// Usage: bun run build:android:<development|preview|release> [--clean]
//   development → debug APK (loads JS from Metro: run `bun run start`)
//   preview     → release APK (JS bundled, installable/sideloadable)
//   release     → release AAB (for Google Play upload)
// Outputs are copied to build/ so `bun run serve:apk` can serve them.
const { spawnSync } = require('node:child_process');
const { copyFileSync, existsSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const ANDROID = join(ROOT, 'android');
const OUT_DIR = join(ROOT, 'build');
const IS_WIN = process.platform === 'win32';
const GRADLEW = IS_WIN ? 'gradlew.bat' : './gradlew';

const PROFILES = {
  development: {
    task: 'assembleDebug',
    output: 'app/build/outputs/apk/debug/app-debug.apk',
    file: 'app-development.apk',
  },
  preview: {
    task: 'assembleRelease',
    output: 'app/build/outputs/apk/release/app-release.apk',
    file: 'app-preview.apk',
  },
  release: {
    task: 'bundleRelease',
    output: 'app/build/outputs/bundle/release/app-release.aab',
    file: 'app-release.aab',
  },
};

const [profileName, ...flags] = process.argv.slice(2);
const profile = PROFILES[profileName];
if (!profile) {
  console.error(`Unknown profile "${profileName}". Use: ${Object.keys(PROFILES).join(', ')}`);
  process.exit(1);
}
const clean = flags.includes('--clean');

function run(cmd, args, cwd, env = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  // Windows: .bat/.cmd shims (gradlew.bat, bunx) can only be spawned through a shell.
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: IS_WIN,
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) {
    console.error(`\n✖ ${cmd} failed (exit ${res.status ?? res.error?.message})`);
    process.exit(res.status ?? 1);
  }
}

// 1. Generate native project (CNG) when missing or when --clean is passed.
if (clean || !existsSync(ANDROID)) {
  run('bunx', ['expo', 'prebuild', '--platform', 'android', '--no-install', ...(clean ? ['--clean'] : [])], ROOT);
}

// 2. Gradle build.
const env = profileName === 'development' ? {} : { NODE_ENV: 'production' };
run(GRADLEW, [profile.task], ANDROID, env);

// 3. Copy output to build/.
const src = join(ANDROID, profile.output);
if (!existsSync(src)) {
  console.error(`✖ Expected output not found: ${src}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
const dest = join(OUT_DIR, profile.file);
copyFileSync(src, dest);
console.log(`\n✔ ${profileName} build: ${dest}`);
if (profileName === 'development') console.log('  Start Metro with `bun run start` before opening the app.');
