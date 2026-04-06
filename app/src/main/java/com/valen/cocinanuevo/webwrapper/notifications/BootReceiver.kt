package com.valen.cocinanuevo.webwrapper

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == "android.intent.action.QUICKBOOT_POWERON") {
            // Reprograma todas las alarmas pendientes guardadas en SharedPreferences
            NotificationScheduler.rescheduleAll(context)
        }
    }
}
