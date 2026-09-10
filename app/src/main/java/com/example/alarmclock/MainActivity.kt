package com.example.alarmclock

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.alarmclock.ui.AlarmListScreen
import com.example.alarmclock.ui.EditAlarmScreen
import com.example.alarmclock.ui.MainViewModel
import com.example.alarmclock.ui.theme.AlarmClockTheme
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AlarmClockTheme {
                AlarmClockApp()
            }
        }
    }
}

@Composable
fun AlarmClockApp(viewModel: MainViewModel = viewModel()) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "alarms") {
        composable("alarms") {
            AlarmListScreen(
                viewModel = viewModel,
                onAdd = { navController.navigate("edit/-1") },
                onEdit = { id -> navController.navigate("edit/$id") }
            )
        }
        composable(
            route = "edit/{alarmId}",
            arguments = listOf(navArgument("alarmId") { type = NavType.LongType })
        ) { entry ->
            val alarmId = entry.arguments?.getLong("alarmId") ?: -1L
            EditAlarmScreen(
                viewModel = viewModel,
                alarmId = alarmId,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
