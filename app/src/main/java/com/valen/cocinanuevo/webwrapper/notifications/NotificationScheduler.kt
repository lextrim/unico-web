package com.valen.cocinanuevo.webwrapper

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

class NotificationScheduler {
    companion object {
        fun scheduleNotification(context: Context, orderId: String, title: String, body: String, triggerAt: Long) {
            val intent = Intent(context, DeliveryAlarmReceiver::class.java).apply {
                putExtra(MainActivity.EXTRA_ORDER_ID, orderId)
                putExtra(MainActivity.EXTRA_TITLE, title)
                putExtra(MainActivity.EXTRA_BODY, body)
                putExtra(MainActivity.EXTRA_TRIGGER_AT, triggerAt)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                orderId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAt,
                pendingIntent
            )
        }
    }
}