package com.expensetracker.sms

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the JS task registered as "SmsReceived" in index.js. */
class SmsHeadlessService : HeadlessJsTaskService() {

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    return HeadlessJsTaskConfig(
        "SmsReceived",
        Arguments.fromBundle(extras),
        30_000, // timeout ms
        true, // allowed while the app is in the foreground
    )
  }
}
