package com.example.alarmclock.scheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.example.alarmclock.MainActivity
import com.example.alarmclock.data.Alarm
import com.example.alarmclock.receiver.AlarmReceiver
import java.util.Calendar

object AlarmScheduler {

    const val EXTRA_ALARM_ID = "com.example.alarmclock.extra.ALARM_ID"
    const val EXTRA_IS_SNOOZE = "com.example.alarmclock.extra.IS_SNOOZE"

    private const val SNOOZE_OFFSET = 100_000L
    private const val SHOW_OFFSET = 200_000L

    fun schedule(context: Context, alarm: Alarm) {
        val trigger = nextTriggerTime(alarm, System.currentTimeMillis())
        setAlarmClock(context, alarm.id, trigger, isSnooze = false)
    }

    fun scheduleSnooze(context: Context, alarm: Alarm) {
        val trigger = System.currentTimeMillis() + alarm.snoozeMinutes * 60_000L
        setAlarmClock(context, alarm.id, trigger, isSnooze = true)
    }

    fun cancel(context: Context, alarmId: Long) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(broadcastPendingIntent(context, alarmId, isSnooze = false))
        am.cancel(broadcastPendingIntent(context, alarmId, isSnooze = true))
    }

    private fun setAlarmClock(context: Context, alarmId: Long, triggerAtMillis: Long, isSnooze: Boolean) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val showIntent = PendingIntent.getActivity(
            context,
            (alarmId + SHOW_OFFSET).toInt(),
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val operation = broadcastPendingIntent(context, alarmId, isSnooze)
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            am.setWindow(AlarmManager.RTC_WAKEUP, triggerAtMillis, 60_000L, operation)
            return
        }
        am.setAlarmClock(
            AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent),
            operation
        )
    }

    private fun broadcastPendingIntent(context: Context, alarmId: Long, isSnooze: Boolean): PendingIntent {
        val requestCode = if (isSnooze) (alarmId + SNOOZE_OFFSET).toInt() else alarmId.toInt()
        val intent = Intent(context, AlarmReceiver::class.java)
            .putExtra(EXTRA_ALARM_ID, alarmId)
            .putExtra(EXTRA_IS_SNOOZE, isSnooze)
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    fun nextTriggerTime(alarm: Alarm, now: Long): Long {
        val calendar = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            set(Calendar.HOUR_OF_DAY, alarm.hour)
            set(Calendar.MINUTE, alarm.minute)
        }
        var attempts = 0
        while (attempts < 8) {
            val dayMatches = !alarm.isRepeating || alarm.isScheduledOn(calendar.get(Calendar.DAY_OF_WEEK))
            if (calendar.timeInMillis > now && dayMatches) break
            calendar.add(Calendar.DATE, 1)
            attempts++
        }
        return calendar.timeInMillis
    }
}
