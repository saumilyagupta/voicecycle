// Adds an optional release signing config to the generated android/app/build.gradle.
// Credentials are read from Gradle properties (for example %USERPROFILE%\.gradle\gradle.properties),
// never from this repository. Without them, release builds fall back to the debug key,
// which is fine for side-loading onto your own phone.
const { withAppBuildGradle } = require('expo/config-plugins');

const PROPERTY = 'VOICECYCLE_UPLOAD_STORE_FILE';
const MARKER = '// voicecycle-release-signing';

const RELEASE_SIGNING = `
        release { ${MARKER}
            if (project.hasProperty('${PROPERTY}')) {
                storeFile file(${PROPERTY})
                storePassword VOICECYCLE_UPLOAD_STORE_PASSWORD
                keyAlias VOICECYCLE_UPLOAD_KEY_ALIAS
                keyPassword VOICECYCLE_UPLOAD_KEY_PASSWORD
            }
        }`;

function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const debugSigning = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
  if (!debugSigning.test(gradle)) {
    throw new Error('withReleaseSigning: could not find signingConfigs.debug in app/build.gradle');
  }
  let next = gradle.replace(debugSigning, `$1${RELEASE_SIGNING}`);

  const releaseBuildType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseBuildType.test(next)) {
    throw new Error('withReleaseSigning: could not find the release buildType signingConfig');
  }
  next = next.replace(
    releaseBuildType,
    `$1signingConfig project.hasProperty('${PROPERTY}') ? signingConfigs.release : signingConfigs.debug`,
  );
  return next;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning only supports Groovy build.gradle files');
    }
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.addReleaseSigning = addReleaseSigning;
