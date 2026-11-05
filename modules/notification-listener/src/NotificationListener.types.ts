export type NotificationPayload = {
  package: string;
  title: string;
  text: string;
  timestamp: number;
};

export type NotificationListenerEvents = {
  onNotificationReceived: (event: NotificationPayload) => void;
};
