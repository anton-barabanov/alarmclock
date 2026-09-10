package com.example.alarmclock.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters

object MathDifficultyConverters {
    @JvmStatic
    @TypeConverter
    fun fromMathDifficulty(value: MathDifficulty): String = value.name

    @JvmStatic
    @TypeConverter
    fun toMathDifficulty(value: String): MathDifficulty = MathDifficulty.valueOf(value)
}

@Database(entities = [Alarm::class], version = 1, exportSchema = false)
@TypeConverters(MathDifficultyConverters::class)
abstract class AlarmDatabase : RoomDatabase() {

    abstract fun alarmDao(): AlarmDao

    companion object {
        @Volatile
        private var instance: AlarmDatabase? = null

        fun getInstance(context: Context): AlarmDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AlarmDatabase::class.java,
                    "alarms.db"
                ).build().also { instance = it }
            }
    }
}
