package expo.modules.notificationlistener

import android.app.Notification
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

class CustomNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "NotificationListener"

        // Set by NotificationListenerModule while the JS runtime is alive.
        @Volatile
        var onNotificationPostedListener: ((Map<String, Any?>) -> Unit)? = null
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return
        // Ignore our own notifications to avoid feedback loops.
        if (sbn.packageName == applicationContext.packageName) return

        val extras: Bundle = sbn.notification.extras ?: Bundle()
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extractText(extras)
        val packageName = sbn.packageName
        val postTime = sbn.postTime

        // 1. App's JS runtime is alive: deliver as a live event only.
        val live = onNotificationPostedListener
        if (live != null) {
            live.invoke(
                mapOf(
                    "package" to packageName,
                    "title" to title,
                    "text" to text,
                    "timestamp" to postTime.toDouble()
                )
            )
            return
        }

        // 2. No JS runtime: dispatch Headless JS task (background/killed).
        val intent = Intent(applicationContext, CustomHeadlessService::class.java).apply {
            putExtra("package", packageName)
            putExtra("title", title)
            putExtra("text", text)
            putExtra("timestamp", postTime)
        }

        try {
            if (applicationContext.startService(intent) != null) {
                HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to start headless task service", e)
        }
    }

    private fun extractText(extras: Bundle): String {
        extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.let { return it.toString() }
        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.let { lines ->
            if (lines.isNotEmpty()) return lines.joinToString("\n")
        }
        return extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
    }
}
