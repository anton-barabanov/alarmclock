package com.example.alarmclock

import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.example.alarmclock.data.Alarm
import com.example.alarmclock.data.AlarmDatabase
import com.example.alarmclock.scheduler.AlarmScheduler
import com.example.alarmclock.service.AlarmService
import com.example.alarmclock.ui.RingingScreen
import com.example.alarmclock.ui.theme.AlarmClockTheme
import android.content.Intent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class RingingActivity : ComponentActivity() {

    private var alarmId = -1L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setVolumeControlStream(AudioManager.STREAM_ALARM)

        alarmId = intent?.getLongExtra(AlarmScheduler.EXTRA_ALARM_ID, -1L) ?: -1L
        if (alarmId == -1L) {
            finish()
            return
        }

        val dao = AlarmDatabase.getInstance(this).alarmDao()
        setContent {
            AlarmClockTheme {
                val alarmState by produceState<Result<Alarm?>?>(initialValue = null, alarmId) {
                    value = withContext(Dispatchers.IO) { runCatching { dao.getById(alarmId) } }
                }
                when (val state = alarmState) {
                    null -> Loading()
                    else -> {
                        val alarm = state.getOrNull()
                        if (alarm == null) {
                            LaunchedEffect(Unit) { stopAlarm() }
                            Loading()
                        } else {
                            RingingScreen(
                                alarm = alarm,
                                onSnooze = {
                                    AlarmScheduler.scheduleSnooze(this@RingingActivity, alarm)
                                    stopAlarm()
                                },
                                onDismiss = { stopAlarm() }
                            )
                        }
                    }
                }
            }
        }
    }

    private fun stopAlarm() {
        stopService(Intent(this, AlarmService::class.java))
        finish()
    }
}

@Composable
private fun Loading() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
