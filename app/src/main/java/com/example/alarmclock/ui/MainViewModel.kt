package com.example.alarmclock.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.alarmclock.data.Alarm
import com.example.alarmclock.data.AlarmDatabase
import com.example.alarmclock.scheduler.AlarmScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val dao = AlarmDatabase.getInstance(application).alarmDao()

    val alarms: StateFlow<List<Alarm>> = dao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun saveAlarm(alarm: Alarm) {
        viewModelScope.launch {
            val id = dao.upsert(alarm)
            val saved = if (alarm.id == 0L) alarm.copy(id = id) else alarm
            val context = getApplication<Application>()
            if (saved.enabled) {
                AlarmScheduler.schedule(context, saved)
            } else {
                AlarmScheduler.cancel(context, saved.id)
            }
        }
    }

    fun deleteAlarm(alarm: Alarm) {
        viewModelScope.launch {
            val context = getApplication<Application>()
            AlarmScheduler.cancel(context, alarm.id)
            dao.delete(alarm)
        }
    }

    fun setEnabled(alarm: Alarm, enabled: Boolean) {
        viewModelScope.launch {
            dao.upsert(alarm.copy(enabled = enabled))
            val context = getApplication<Application>()
            if (enabled) {
                AlarmScheduler.schedule(context, alarm)
            } else {
                AlarmScheduler.cancel(context, alarm.id)
            }
        }
    }

    suspend fun getAlarmOnce(id: Long): Alarm? = withContext(Dispatchers.IO) { dao.getById(id) }
}
