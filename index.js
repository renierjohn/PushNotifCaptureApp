import { AppRegistry } from 'react-native';
import 'expo-router/entry';

// Runs when a notification arrives while the app's JS runtime is not alive.
// Name must match HeadlessJsTaskConfig in CustomHeadlessService.kt.
AppRegistry.registerHeadlessTask('NotificationBackgroundProcessor', () => async (data) => {
  const { package: pkg, title, text, timestamp } = data;
  console.log(`[Headless Task] ${pkg} @ ${timestamp}: ${title} - ${text}`);
  // TODO: persist or sync (e.g. fetch to your API).
});
