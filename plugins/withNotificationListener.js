const { withAndroidManifest } = require('expo/config-plugins');

const withNotificationListener = (config) => {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    mainApplication.service = mainApplication.service || [];

    const listenerName = 'expo.modules.notificationlistener.CustomNotificationListener';
    const headlessServiceName = 'expo.modules.notificationlistener.CustomHeadlessService';

    // 1. Add NotificationListenerService
    if (!mainApplication.service.find((s) => s.$['android:name'] === listenerName)) {
      mainApplication.service.push({
        $: {
          'android:name': listenerName,
          'android:label': 'CustomNotificationListener',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }],
          },
        ],
      });
    }

    // 2. Add HeadlessJsTaskService
    if (!mainApplication.service.find((s) => s.$['android:name'] === headlessServiceName)) {
      mainApplication.service.push({
        $: {
          'android:name': headlessServiceName,
          'android:exported': 'false',
        },
      });
    }

    return config;
  });
};

module.exports = withNotificationListener;
