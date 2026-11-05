// Local Gradle builds for Android, per profile. Run with --help for usage.
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

const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'];
const ABI_ALIASES = {
  arm64: 'arm64-v8a',
  aarch64: 'arm64-v8a',
  'arm64-v8a': 'arm64-v8a',
  arm: 'armeabi-v7a',
  arm32: 'armeabi-v7a',
  armv7: 'armeabi-v7a',
  'armeabi-v7a': 'armeabi-v7a',
  x64: 'x86_64',
  'x86-64': 'x86_64',
  x86_64: 'x86_64',
  x86: 'x86',
};

const HELP = `Build the Android app locally with Gradle.

Usage:
  bun run build:android:<profile> [--arch <cpu,...>] [--clean]

Profiles:
  development   Debug APK; loads JS from Metro (run \`bun run start\` first)
  preview       Release APK; JS bundled, installable by sideloading
  release       Release AAB for Google Play upload

Options:
  --arch, -a <cpu,...>  CPU types (ABIs) to compile native code for. Default: all
                        arm64      arm64-v8a    real phones/tablets (most devices)
                        arm        armeabi-v7a  old/cheap 32-bit phones
                        x64        x86_64       emulators on Windows/Intel PCs
                        x86        x86          old 32-bit emulators
                        all        all of the above
  --clean               Regenerate android/ (expo prebuild --clean) before building
  --help, -h            Show this help

Examples:
  bun run build:android:development --arch arm64        fast build for your phone
  bun run build:android:development --arch x64          Android emulator on a PC
  bun run build:android:preview --arch arm64,x64        phone + emulator
  bun run build:android:release                         all CPUs (recommended for Play)

Tips:
  - Check your phone's CPU: adb shell getprop ro.product.cpu.abi
  - Fewer CPU types = much faster native (C++) builds and smaller APKs.
  - Google Play delivers only the matching CPU from an AAB, so keep all for release.`;

function fail(msg) {
  console.error(`✖ ${msg}\n`);
  console.error('Run with --help for usage.');
  process.exit(1);
}

function parseAbis(value) {
  if (!value) fail('--arch needs a value, e.g. --arch arm64 or --arch arm64,x64');
  const parts = value.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (parts.includes('all')) return [...ABIS];
  const abis = parts.map((v) => {
    const abi = ABI_ALIASES[v];
    if (!abi) {
      const hint = Object.keys(ABI_ALIASES).find((k) => k.startsWith(v.slice(0, 3)));
      fail(`Unknown CPU type "${v}".${hint ? ` Did you mean "${hint}"?` : ''} Use: arm64, arm, x64, x86, all`);
    }
    return abi;
  });
  return [...new Set(abis)];
}

const args = process.argv.slice(2).filter((a) => a !== '--');
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const [profileName, ...flags] = args;
const profile = PROFILES[profileName];
if (!profile) {
  const hint = Object.keys(PROFILES).find((p) => p.startsWith(String(profileName).slice(0, 3)));
  fail(`Unknown profile "${profileName}".${hint ? ` Did you mean "${hint}"?` : ''} Use: ${Object.keys(PROFILES).join(', ')}`);
}

let clean = false;
let abis = [...ABIS];
for (let i = 0; i < flags.length; i++) {
  const f = flags[i];
  if (f === '--clean') clean = true;
  else if (f === '--arch' || f === '-a') abis = parseAbis(flags[++i]);
  else if (f.startsWith('--arch=')) abis = parseAbis(f.slice('--arch='.length));
  else fail(`Unknown option "${f}".`);
}
const allAbis = abis.length === ABIS.length;

// With shell: true (Windows) values with spaces or commas must be quoted.
const q = (v) => (IS_WIN ? `"${v}"` : v);

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
// The Android Gradle plugin requests a JDK 17 toolchain. Without a toolchain download
// repository (foojay) Gradle can't auto-provision one, so point it at the local JDK
// from JAVA_HOME and disable auto-download to get a clear error instead.
const javaHome = process.env.JAVA_HOME;
const hasJavaHome = Boolean(javaHome && existsSync(javaHome));
if (!hasJavaHome) {
  console.warn(
    '⚠ JAVA_HOME is not set or does not exist; Gradle will only use JDKs it can auto-detect. Install JDK 17 (e.g. Eclipse Temurin 17) and set JAVA_HOME to it.\n' +
      '  Windows: setx JAVA_HOME "C:\\Program Files\\Eclipse Adoptium\\jdk-17.x.x-hotspot" (then reopen the terminal)\n' +
      '  macOS:   export JAVA_HOME=$(/usr/libexec/java_home -v 17)',
  );
}
console.log(`CPU types: ${abis.join(', ')}${allAbis ? ' (all — pass --arch arm64 for a faster local build)' : ''}`);
const gradleArgs = [
  profile.task,
  q(`-PreactNativeArchitectures=${abis.join(',')}`),
  ...(hasJavaHome ? [`-Porg.gradle.java.installations.paths=${q(javaHome)}`] : []),
  '-Porg.gradle.java.installations.auto-download=false',
];
const env = profileName === 'development' ? {} : { NODE_ENV: 'production' };
run(GRADLEW, gradleArgs, ANDROID, env);

// 3. Copy output to build/.
const src = join(ANDROID, profile.output);
if (!existsSync(src)) {
  console.error(`✖ Expected output not found: ${src}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
// Suffix the file with the CPU types when not building all of them.
const fileName = allAbis ? profile.file : profile.file.replace(/(\.\w+)$/, `-${abis.join('+')}$1`);
const dest = join(OUT_DIR, fileName);
copyFileSync(src, dest);
console.log(`\n✔ ${profileName} build: ${dest}`);
if (profileName === 'development') console.log('  Start Metro with `bun run start` before opening the app.');
if (profileName === 'release' && !allAbis) {
  console.log('  ⚠ Release AAB built for some CPU types only; devices with other CPUs cannot install it from Play.');
}
