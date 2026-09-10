package com.example.alarmclock.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface AlarmDao {

    @Query("SELECT * FROM alarms ORDER BY hour, minute")
    fun getAll(): Flow<List<Alarm>>

    @Query("SELECT * FROM alarms")
    suspend fun getAllOnce(): List<Alarm>

    @Query("SELECT * FROM alarms WHERE id = :id")
    suspend fun getById(id: Long): Alarm?

    @Upsert
    suspend fun upsert(alarm: Alarm): Long

    @Delete
    suspend fun delete(alarm: Alarm)
}
