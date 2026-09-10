package com.example.alarmclock.util

import com.example.alarmclock.data.MathDifficulty
import kotlin.random.Random

object MathGenerator {

    data class Problem(val question: String, val answer: Int)

    fun generate(difficulty: MathDifficulty): Problem = when (difficulty) {
        MathDifficulty.OFF -> Problem("", 0)
        MathDifficulty.EASY -> easy()
        MathDifficulty.MEDIUM -> medium()
        MathDifficulty.HARD -> hard()
    }

    private fun easy(): Problem {
        val a = Random.nextInt(2, 21)
        val b = Random.nextInt(2, 21)
        return if (a >= b && Random.nextBoolean()) {
            Problem("$a - $b = ?", a - b)
        } else {
            Problem("$a + $b = ?", a + b)
        }
    }

    private fun medium(): Problem = if (Random.nextBoolean()) {
        val a = Random.nextInt(3, 13)
        val b = Random.nextInt(3, 13)
        Problem("$a × $b = ?", a * b)
    } else {
        val a = Random.nextInt(15, 90)
        val b = Random.nextInt(11, 80)
        Problem("$a + $b = ?", a + b)
    }

    private fun hard(): Problem = when (Random.nextInt(3)) {
        0 -> {
            val a = Random.nextInt(4, 16)
            val b = Random.nextInt(4, 13)
            val c = Random.nextInt(5, 41)
            Problem("$a × $b + $c = ?", a * b + c)
        }
        1 -> {
            val a = Random.nextInt(4, 16)
            val b = Random.nextInt(4, 13)
            val c = Random.nextInt(5, 41)
            if (a * b >= c) Problem("$a × $b - $c = ?", a * b - c)
            else Problem("$a × $b + $c = ?", a * b + c)
        }
        else -> {
            val a = Random.nextInt(3, 10)
            val b = Random.nextInt(4, 16)
            val c = Random.nextInt(3, 10)
            Problem("($a + $b) × $c = ?", (a + b) * c)
        }
    }
}
