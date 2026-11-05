package expo.modules.notificationlistener

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class CustomHeadlessService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
        val extras = intent.extras ?: return null

        // Convert Intent extras into a React Native readable map
        val data = Arguments.createMap().apply {
            putString("package", extras.getString("package"))
            putString("title", extras.getString("title"))
            putString("text", extras.getString("text"))
            putDouble("timestamp", extras.getLong("timestamp").toDouble())
        }

        return HeadlessJsTaskConfig(
            "NotificationBackgroundProcessor", // Registered task name in JS
            data,
            5000, // Timeout in ms (adjust if doing network I/O)
            true  // Allowed in foreground/background
        )
    }
}
