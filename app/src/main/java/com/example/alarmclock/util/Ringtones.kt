package com.example.alarmclock.util

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.net.toUri
import com.example.alarmclock.R

object Ringtones {

    data class BuiltIn(val key: String, val title: String, val resId: Int)

    val BUILT_IN = listOf(
        BuiltIn("classic", "Классический", R.raw.alarm_classic),
        BuiltIn("rise", "Нарастающий", R.raw.alarm_rise),
        BuiltIn("arpeggio", "Арпеджио", R.raw.alarm_arpeggio),
        BuiltIn("bell", "Колокольчик", R.raw.alarm_bell),
        BuiltIn("phone", "Телефон", R.raw.alarm_phone)
    )

    fun uriFor(context: Context, builtIn: BuiltIn): String =
        "android.resource://${context.packageName}/${builtIn.resId}"

    fun uriForKey(context: Context, key: String): String? =
        BUILT_IN.firstOrNull { it.key == key }?.let { uriFor(context, it) }

    fun titleFor(context: Context, uri: String): String = when {
        uri.isEmpty() -> "По умолчанию"
        uri.startsWith("android.resource://") ->
            BUILT_IN.firstOrNull { uriForKey(context, it.key) == uri }?.title ?: "Встроенная"
        else -> displayName(context, uri.toUri())
    }

    private fun displayName(context: Context, uri: Uri): String {
        context.contentResolver
            .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && cursor.moveToFirst()) return cursor.getString(index)
            }
        return uri.lastPathSegment ?: "Файл"
    }
}
