// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addReleaseSigning } = require('../withReleaseSigning');

const GENERATED = `
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('addReleaseSigning', () => {
  it('adds a property-driven release config and keeps debug signing for debug builds', () => {
    const result: string = addReleaseSigning(GENERATED);
    expect(result).toContain("if (project.hasProperty('VOICECYCLE_UPLOAD_STORE_FILE'))");
    expect(result).toContain(
      "signingConfig project.hasProperty('VOICECYCLE_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    expect(result).toMatch(/debug \{\s*signingConfig signingConfigs\.debug\s*\}/);
  });

  it('never contains credentials', () => {
    expect(addReleaseSigning(GENERATED)).not.toMatch(/storePassword '[^a]/);
  });

  it('is idempotent', () => {
    const once: string = addReleaseSigning(GENERATED);
    expect(addReleaseSigning(once)).toBe(once);
  });

  it('fails loudly when the template changes', () => {
    expect(() => addReleaseSigning('android {}')).toThrow(/signingConfigs.debug/);
  });
});
