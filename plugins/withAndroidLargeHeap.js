const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidLargeHeap(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];

    if (application?.$) {
      application.$['android:largeHeap'] = 'true';
    }

    return config;
  });
};
