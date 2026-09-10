package com.example.alarmclock.ui

import android.content.Context
import android.text.format.DateFormat
import com.example.alarmclock.data.Alarm
import com.example.alarmclock.scheduler.AlarmScheduler
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

fun formatTimeOfDay(context: Context, hour: Int, minute: Int): String {
    val calendar = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
    }
    return DateFormat.getTimeFormat(context).format(calendar.time)
}

private val DAY_NAMES = mapOf(
    java.util.Calendar.MONDAY to "Пн",
    java.util.Calendar.TUESDAY to "Вт",
    java.util.Calendar.WEDNESDAY to "Ср",
    java.util.Calendar.THURSDAY to "Чт",
    java.util.Calendar.FRIDAY to "Пт",
    java.util.Calendar.SATURDAY to "Сб",
    java.util.Calendar.SUNDAY to "Вс"
)

fun daysLabel(alarm: Alarm): String {
    if (!alarm.isRepeating) return "Один раз"
    val selected = Alarm.WEEK_ORDER
        .filter { alarm.isScheduledOn(it) }
        .mapNotNull { DAY_NAMES[it] }
    if (selected.size == 7) return "Каждый день"
    if (selected == listOf("Пн", "Вт", "Ср", "Чт", "Пт")) return "По будням"
    if (selected == listOf("Сб", "Вс")) return "По выходным"
    return selected.joinToString(", ")
}

fun formatNextTrigger(alarm: Alarm): String {
    val trigger = AlarmScheduler.nextTriggerTime(alarm, System.currentTimeMillis())
    val format = SimpleDateFormat("EEE, d MMM · HH:mm", Locale.getDefault())
    return format.format(Date(trigger))
}
