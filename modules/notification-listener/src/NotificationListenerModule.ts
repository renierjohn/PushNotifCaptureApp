import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { NotificationListenerEvents } from './NotificationListener.types';

declare class NotificationListenerModule extends NativeModule<NotificationListenerEvents> {
  isPermissionGranted(): boolean;
}

// Null on platforms without the native module (iOS, web, Expo Go).
export default requireOptionalNativeModule<NotificationListenerModule>('NotificationListener');
