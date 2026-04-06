package com.valen.cocinanuevo.webwrapper

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject

class NotificationScheduler {
    companion object {

        private const val PREFS_NAME = "unico_notifications"
        private const val PREFS_KEY  = "scheduled"

        fun scheduleNotification(context: Context, orderId: String, title: String, body: String, triggerAt: Long) {
            // Persistir para sobrevivir reinicios
            saveToPrefs(context, orderId, title, body, triggerAt)

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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                // Sin permiso exacto: usar alarma inexacta como fallback
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            } else {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            }
        }

        fun cancelNotification(context: Context, orderId: String) {
            removeFromPrefs(context, orderId)

            val intent = Intent(context, DeliveryAlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                orderId.hashCode(),
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
        }

        fun rescheduleAll(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val raw = prefs.getString(PREFS_KEY, "{}") ?: "{}"
            val json = JSONObject(raw)
            val now = System.currentTimeMillis()
            val keys = json.keys()
            while (keys.hasNext()) {
                val orderId = keys.next()
                val entry = json.getJSONObject(orderId)
                val triggerAt = entry.getLong("triggerAt")
                if (triggerAt > now) {
                    scheduleNotification(
                        context,
                        orderId,
                        entry.getString("title"),
                        entry.getString("body"),
                        triggerAt
                    )
                }
            }
        }

        private fun saveToPrefs(context: Context, orderId: String, title: String, body: String, triggerAt: Long) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = JSONObject(prefs.getString(PREFS_KEY, "{}") ?: "{}")
            json.put(orderId, JSONObject().apply {
                put("title", title)
                put("body", body)
                put("triggerAt", triggerAt)
            })
            prefs.edit().putString(PREFS_KEY, json.toString()).apply()
        }

        private fun removeFromPrefs(context: Context, orderId: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = JSONObject(prefs.getString(PREFS_KEY, "{}") ?: "{}")
            json.remove(orderId)
            prefs.edit().putString(PREFS_KEY, json.toString()).apply()
        }
    }
}
