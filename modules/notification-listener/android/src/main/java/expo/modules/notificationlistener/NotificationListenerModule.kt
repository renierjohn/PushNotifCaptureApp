package expo.modules.notificationlistener

import android.content.Context
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React Context not initialized")

    override fun definition() = ModuleDefinition {
        Name("NotificationListener")

        Events("onNotificationReceived")

        OnCreate {
            CustomNotificationListener.onNotificationPostedListener = { data ->
                sendEvent("onNotificationReceived", data)
            }
        }

        OnDestroy {
            CustomNotificationListener.onNotificationPostedListener = null
        }

        Function("isPermissionGranted") {
            NotificationManagerCompat.getEnabledListenerPackages(context)
                .contains(context.packageName)
        }
    }
}
