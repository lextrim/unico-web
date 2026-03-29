package com.valen.cocinanuevo.webwrapper

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Este archivo se encarga de que, si el móvil se apaga o se reinicia,
 * la App se entere para poder reactivar las notificaciones si fuera necesario.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Aquí se podrían reprogramar notificaciones desde una base de datos local
            // Por ahora, lo dejamos listo para que no dé error de compilación
        }
    }
}