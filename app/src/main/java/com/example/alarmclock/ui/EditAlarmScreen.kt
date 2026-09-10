@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package com.example.alarmclock.ui

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.alarmclock.data.Alarm
import com.example.alarmclock.data.MathDifficulty
import com.example.alarmclock.util.Ringtones
import java.util.Calendar

@Composable
fun EditAlarmScreen(viewModel: MainViewModel, alarmId: Long, onBack: () -> Unit) {
    var initial by remember { mutableStateOf<Alarm?>(null) }
    LaunchedEffect(alarmId) {
        initial = if (alarmId > 0) viewModel.getAlarmOnce(alarmId) else Alarm()
    }
    when (val loaded = initial) {
        null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        else -> EditAlarmForm(
            initial = loaded,
            isNew = alarmId <= 0,
            onSave = { viewModel.saveAlarm(it); onBack() },
            onDelete = { viewModel.deleteAlarm(loaded); onBack() },
            onBack = onBack
        )
    }
}

@Composable
private fun EditAlarmForm(
    initial: Alarm,
    isNew: Boolean,
    onSave: (Alarm) -> Unit,
    onDelete: (Alarm) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val timeState = rememberTimePickerState(
        initialHour = initial.hour,
        initialMinute = initial.minute,
        is24Hour = android.text.format.DateFormat.is24HourFormat(context)
    )
    var label by remember { mutableStateOf(initial.label) }
    var daysMask by remember { mutableIntStateOf(initial.daysMask) }
    var vibrate by remember { mutableStateOf(initial.vibrate) }
    var snoozeMinutes by remember { mutableFloatStateOf(initial.snoozeMinutes.toFloat()) }
    var difficulty by remember { mutableStateOf(initial.mathDifficulty) }
    var ringtoneUri by remember { mutableStateOf(initial.ringtoneUri) }
    var ringtoneLabel by remember {
        mutableStateOf(Ringtones.titleFor(context, initial.ringtoneUri))
    }
    var showRingtoneDialog by remember { mutableStateOf(false) }
    var previewPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

    val playPreview: (Int) -> Unit = { resId ->
        previewPlayer?.run { runCatching { stop(); release() } }
        previewPlayer = createPreviewPlayer(context, resId)
    }
    DisposableEffect(Unit) {
        onDispose { previewPlayer?.run { runCatching { stop(); release() } } }
    }

    val pickAudio = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            ringtoneUri = uri.toString()
            ringtoneLabel = Ringtones.titleFor(context, uri.toString())
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isNew) "Новый будильник" else "Будильник") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            onSave(
                                initial.copy(
                                    hour = timeState.hour,
                                    minute = timeState.minute,
                                    label = label.trim(),
                                    daysMask = daysMask,
                                    vibrate = vibrate,
                                    snoozeMinutes = snoozeMinutes.toInt().coerceIn(1, 60),
                                    mathDifficulty = difficulty,
                                    ringtoneUri = ringtoneUri,
                                    enabled = true
                                )
                            )
                        }
                    ) { Text("Сохранить") }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            TimePicker(state = timeState)

            OutlinedTextField(
                value = label,
                onValueChange = { label = it },
                label = { Text("Название") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Column {
                Text(
                    "Повторять",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Alarm.WEEK_ORDER.forEach { day ->
                        FilterChip(
                            selected = daysMask and (1 shl (day - 1)) != 0,
                            onClick = { daysMask = daysMask xor (1 shl (day - 1)) },
                            label = { Text(DAY_SHORT_NAMES.getValue(day)) }
                        )
                    }
                }
            }

            Surface(
                onClick = { showRingtoneDialog = true },
                shape = MaterialTheme.shapes.large,
                tonalElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Мелодия", style = MaterialTheme.typography.titleMedium)
                        Text(
                            ringtoneLabel,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (showRingtoneDialog) {
                AlertDialog(
                    onDismissRequest = { showRingtoneDialog = false },
                    title = { Text("Мелодия") },
                    text = {
                        Column {
                            RingtoneRow(
                                title = "По умолчанию",
                                selected = ringtoneUri.isEmpty(),
                                onClick = {
                                    ringtoneUri = ""
                                    ringtoneLabel = "По умолчанию"
                                    showRingtoneDialog = false
                                }
                            )
                            Ringtones.BUILT_IN.forEach { ringtone ->
                                RingtoneRow(
                                    title = ringtone.title,
                                    selected = ringtoneUri == Ringtones.uriFor(context, ringtone),
                                    onClick = {
                                        ringtoneUri = Ringtones.uriFor(context, ringtone)
                                        ringtoneLabel = ringtone.title
                                        showRingtoneDialog = false
                                    },
                                    onPreview = { playPreview(ringtone.resId) }
                                )
                            }
                            TextButton(onClick = {
                                pickAudio.launch(arrayOf("audio/*"))
                                showRingtoneDialog = false
                            }) { Text("Выбрать файл…") }
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = { showRingtoneDialog = false }) { Text("Отмена") }
                    }
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Вибрация", Modifier.weight(1f))
                Switch(checked = vibrate, onCheckedChange = { vibrate = it })
            }

            Column {
                Text(
                    "Отложить на ${snoozeMinutes.toInt()} мин",
                    style = MaterialTheme.typography.titleMedium
                )
                Slider(
                    value = snoozeMinutes,
                    onValueChange = { snoozeMinutes = it },
                    valueRange = 1f..30f,
                    steps = 28
                )
            }

            Column {
                Text(
                    "Отключение с примером",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MathDifficulty.entries.forEach { value ->
                        FilterChip(
                            selected = difficulty == value,
                            onClick = { difficulty = value },
                            label = { Text(DIFFICULTY_LABELS.getValue(value)) }
                        )
                    }
                }
                Text(
                    "Чтобы отключить будильник, нужно решить математический пример",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (!isNew) {
                OutlinedButton(
                    onClick = { onDelete(initial) },
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Удалить будильник") }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

private val DAY_SHORT_NAMES = mapOf(
    Calendar.MONDAY to "Пн",
    Calendar.TUESDAY to "Вт",
    Calendar.WEDNESDAY to "Ср",
    Calendar.THURSDAY to "Чт",
    Calendar.FRIDAY to "Пт",
    Calendar.SATURDAY to "Сб",
    Calendar.SUNDAY to "Вс"
)

private val DIFFICULTY_LABELS = mapOf(
    MathDifficulty.OFF to "Выкл",
    MathDifficulty.EASY to "Легко",
    MathDifficulty.MEDIUM to "Средне",
    MathDifficulty.HARD to "Сложно"
)

@Composable
private fun RingtoneRow(
    title: String,
    selected: Boolean,
    onClick: () -> Unit,
    onPreview: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (onPreview != null) {
            IconButton(onClick = onPreview) {
                Icon(Icons.Filled.PlayArrow, contentDescription = "Прослушать")
            }
        }
        Text(
            title,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
        RadioButton(selected = selected, onClick = onClick)
    }
}

private fun createPreviewPlayer(context: Context, resId: Int): MediaPlayer? = try {
    MediaPlayer().apply {
        setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        )
        context.resources.openRawResourceFd(resId)?.use { afd ->
            setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
        } ?: throw IllegalStateException("raw resource not found: $resId")
        isLooping = false
        setOnCompletionListener { mp -> runCatching { mp.release() } }
        prepare()
        start()
    }
} catch (e: Exception) {
    null
}
