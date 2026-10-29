package com.upitracker.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.HeadlessJsTaskService

/**
 * Fires for every incoming SMS. Keeps only bank senders and hands each one to
 * the JS headless task "SmsReceived" (works even when the app is closed).
 */
class SmsReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    val wanted = SenderCodes.load(context)

    // A long SMS arrives as several parts; join them per sender.
    parts
        .filter { it.originatingAddress != null }
        .groupBy { it.originatingAddress!! }
        .filterKeys { SenderCodes.codeOf(it) in wanted }
        .forEach { (sender, pieces) ->
          val service = Intent(context, SmsHeadlessService::class.java)
          service.putExtra("sender", sender)
          service.putExtra("body", pieces.joinToString("") { it.messageBody ?: "" })
          service.putExtra("timestamp", pieces.first().timestampMillis.toDouble())
          context.startService(service)
          HeadlessJsTaskService.acquireWakeLockNow(context)
        }
  }
}
