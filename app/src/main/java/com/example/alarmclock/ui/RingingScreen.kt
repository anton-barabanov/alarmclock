@file:OptIn(ExperimentalMaterial3Api::class)

package com.example.alarmclock.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.alarmclock.data.Alarm
import com.example.alarmclock.data.MathDifficulty
import com.example.alarmclock.util.MathGenerator

@Composable
fun RingingScreen(alarm: Alarm, onSnooze: () -> Unit, onDismiss: () -> Unit) {
    BackHandler {}
    val context = androidx.compose.ui.platform.LocalContext.current
    var problem by remember { mutableStateOf(MathGenerator.generate(alarm.mathDifficulty)) }
    var answer by remember { mutableStateOf("") }
    var wrong by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = formatTimeOfDay(context, alarm.hour, alarm.minute),
                style = MaterialTheme.typography.displayLarge,
                fontWeight = FontWeight.Bold
            )
            if (alarm.label.isNotEmpty()) {
                Text(alarm.label, style = MaterialTheme.typography.titleLarge)
            }

            if (alarm.mathDifficulty != MathDifficulty.OFF) {
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            "Решите пример, чтобы отключить",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            problem.question,
                            style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.Bold
                        )
                        OutlinedTextField(
                            value = answer,
                            onValueChange = {
                                wrong = false
                                answer = it.filter { ch -> ch.isDigit() }
                            },
                            isError = wrong,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Ответ") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                        if (wrong) {
                            Text(
                                "Неверно, попробуйте ещё раз",
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
                Button(
                    onClick = {
                        if (answer.trim().toIntOrNull() == problem.answer) {
                            onDismiss()
                        } else {
                            wrong = true
                            answer = ""
                            problem = MathGenerator.generate(alarm.mathDifficulty)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) { Text("Отключить") }
            } else {
                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) { Text("Отключить") }
            }

            OutlinedButton(
                onClick = onSnooze,
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) { Text("Отложить на ${alarm.snoozeMinutes} мин") }
        }
    }
}
