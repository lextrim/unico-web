package com.valen.cocinanuevo.webwrapper

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class SnoozeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val orderId = intent.getStringExtra(MainActivity.EXTRA_ORDER_ID) ?: return
        val title = intent.getStringExtra(MainActivity.EXTRA_TITLE) ?: "Recordatorio"
        val body = intent.getStringExtra(MainActivity.EXTRA_BODY) ?: ""

        // Posponer 15 minutos
        val snoozeTime = System.currentTimeMillis() + (15 * 60 * 1000)

        NotificationScheduler.scheduleNotification(
            context,
            orderId,
            title,
            body,
            snoozeTime
        )
    }
}