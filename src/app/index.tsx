import { useEffect, useState } from 'react';
import { AppState, Button, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import NotificationListener, { type NotificationPayload } from '../../modules/notification-listener';

const isGranted = () => NotificationListener?.isPermissionGranted() ?? false;

export default function Home() {
  const [hasPermission, setHasPermission] = useState(isGranted);
  const [latest, setLatest] = useState<NotificationPayload | null>(null);


  const openSettings = () => {
    Linking.sendIntent('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS');
  };

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setHasPermission(isGranted());
    });
    const sub = NotificationListener?.addListener('onNotificationReceived', setLatest);
    return () => {
      appState.remove();
      sub?.remove();
    };
  }, []);

  if (Platform.OS !== 'android' || !NotificationListener) {
    return (
      <View style={styles.container}>
        <Text>Notification capture is only available in an Android development build.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notification Interceptor</Text>
      <Text>Permission Enabled: {hasPermission ? 'YES' : 'NO'}</Text>

      {!hasPermission && <Button title="Enable in Android Settings" onPress={openSettings} />}

      {latest && (
        <View style={styles.card}>
          <Text style={styles.bold}>From: {latest.package}</Text>
          <Text>Title: {latest.title}</Text>
          <Text>Body: {latest.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 8 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  bold: { fontWeight: 'bold' },
  card: { marginTop: 20, padding: 12, backgroundColor: '#eee', borderRadius: 8, width: '100%' },
});
