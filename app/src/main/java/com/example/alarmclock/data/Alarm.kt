package com.example.alarmclock.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Calendar

enum class MathDifficulty { OFF, EASY, MEDIUM, HARD }

@Entity(tableName = "alarms")
data class Alarm(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val hour: Int = 8,
    val minute: Int = 0,
    val enabled: Boolean = true,
    val daysMask: Int = 0,
    val label: String = "",
    val ringtoneUri: String = "",
    val vibrate: Boolean = true,
    val snoozeMinutes: Int = 10,
    val mathDifficulty: MathDifficulty = MathDifficulty.EASY
) {
    val isRepeating: Boolean get() = daysMask != 0

    fun isScheduledOn(dayOfWeek: Int): Boolean =
        daysMask and (1 shl (dayOfWeek - 1)) != 0

    fun withDay(dayOfWeek: Int, enabled: Boolean): Alarm {
        val bit = 1 shl (dayOfWeek - 1)
        return copy(daysMask = if (enabled) daysMask or bit else daysMask and bit.inv())
    }

    companion object {
        val WEEK_ORDER = listOf(
            Calendar.MONDAY,
            Calendar.TUESDAY,
            Calendar.WEDNESDAY,
            Calendar.THURSDAY,
            Calendar.FRIDAY,
            Calendar.SATURDAY,
            Calendar.SUNDAY
        )
    }
}
