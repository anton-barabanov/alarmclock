package com.example.alarmclock.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.net.toUri
import com.example.alarmclock.R
import com.example.alarmclock.RingingActivity
import com.example.alarmclock.data.Alarm
import com.example.alarmclock.data.AlarmDatabase
import com.example.alarmclock.scheduler.AlarmScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.Locale

class AlarmService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var alarmId = -1L

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.channel_alarms),
            NotificationManager.IMPORTANCE_HIGH
        )
        nm.createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        val id = intent.getLongExtra(AlarmScheduler.EXTRA_ALARM_ID, -1L)
        val isSnooze = intent.getBooleanExtra(AlarmScheduler.EXTRA_IS_SNOOZE, false)
        if (id == -1L) {
            stopSelf()
            return START_NOT_STICKY
        }
        alarmId = id
        scope.launch {
            val dao = AlarmDatabase.getInstance(applicationContext).alarmDao()
            val alarm = dao.getById(id)
            if (alarm == null) {
                stopEverything()
                return@launch
            }
            startAsForeground(alarm)
            if (!isSnooze) {
                if (alarm.isRepeating) {
                    AlarmScheduler.schedule(applicationContext, alarm)
                } else {
                    dao.upsert(alarm.copy(enabled = false))
                }
            }
            startRinging(alarm)
        }
        return START_NOT_STICKY
    }

    private fun startAsForeground(alarm: Alarm) {
        val notification = buildNotification(alarm)
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                notificationId(alarm.id),
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(notificationId(alarm.id), notification)
        }
    }

    private fun notificationId(id: Long): Int = (1_000L + id).toInt()

    private fun buildNotification(alarm: Alarm): Notification {
        val ringIntent = Intent(this, RingingActivity::class.java)
            .putExtra(AlarmScheduler.EXTRA_ALARM_ID, alarm.id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val contentPi = PendingIntent.getActivity(
            this,
            alarm.id.toInt(),
            ringIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_alarm)
            .setContentTitle(alarm.label.ifEmpty { getString(R.string.app_name) })
            .setContentText(String.format(Locale.getDefault(), "%02d:%02d", alarm.hour, alarm.minute))
            .setCategory(Notification.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setFullScreenIntent(contentPi, true)
            .setContentIntent(contentPi)
            .build()
    }

    private fun startRinging(alarm: Alarm) {
        acquireWakeLock()
        if (alarm.vibrate) startVibration()
        startSound(alarm.ringtoneUri)
        handler.postDelayed({ stopEverything() }, RING_TIMEOUT_MS)
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "alarmclock:ringing")
            .apply { acquire(RING_TIMEOUT_MS + 60_000L) }
    }

    private fun startVibration() {
        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.takeIf { it.hasVibrator() }?.vibrate(
            VibrationEffect.createWaveform(longArrayOf(0, 600, 400), 0)
        )
    }

    private fun startSound(ringtoneUri: String) {
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: Settings.System.DEFAULT_ALARM_ALERT_URI
        player = MediaPlayer()
        try {
            player?.apply {
                setAudioAttributes(attributes)
                if (ringtoneUri.isNotBlank()) {
                    try {
                        setDataSource(applicationContext, ringtoneUri.toUri())
                    } catch (e: Exception) {
                        setDataSource(applicationContext, defaultUri)
                    }
                } else {
                    setDataSource(applicationContext, defaultUri)
                }
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            player?.release()
            player = null
        }
    }

    private fun stopEverything() {
        handler.removeCallbacksAndMessages(null)
        player?.run {
            runCatching { stop() }
            release()
        }
        player = null
        vibrator?.cancel()
        vibrator = null
        wakeLock?.run { runCatching { release() } }
        wakeLock = null
        if (alarmId != -1L) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(notificationId(alarmId))
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopEverything()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "alarms"
        private const val RING_TIMEOUT_MS = 10 * 60_000L
    }
}
