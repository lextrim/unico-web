package com.valen.cocinanuevo.webwrapper

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class DeliveryAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val orderId = intent.getStringExtra(MainActivity.EXTRA_ORDER_ID) ?: return
        val title = intent.getStringExtra(MainActivity.EXTRA_TITLE) ?: "Entrega de Pedido"
        val body = intent.getStringExtra(MainActivity.EXTRA_BODY) ?: "Tienes una entrega programada"

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "delivery_channel"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Entregas", NotificationManager.IMPORTANCE_HIGH)
            notificationManager.createNotificationChannel(channel)
        }

        // Acción al tocar la notificación
        val mainIntent = Intent(context, MainActivity::class.java)
        val mainPendingIntent = PendingIntent.getActivity(context, orderId.hashCode(), mainIntent, PendingIntent.FLAG_IMMUTABLE)

        // Acción de Posponer (Snooze)
        val snoozeIntent = Intent(context, SnoozeReceiver::class.java).apply {
            putExtra(MainActivity.EXTRA_ORDER_ID, orderId)
            putExtra(MainActivity.EXTRA_TITLE, title)
            putExtra(MainActivity.EXTRA_BODY, body)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(context, orderId.hashCode() + 1, snoozeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(mainPendingIntent)
            .addAction(android.R.drawable.ic_lock_idle_alarm, "Posponer 15 min", snoozePendingIntent)
            .build()

        notificationManager.notify(orderId.hashCode(), notification)
    }
}