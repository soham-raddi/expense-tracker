package com.upitracker.sms

import android.provider.Telephony
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

/**
 * Reads bank SMS from the inbox. SMS bodies are passed to JS only and are
 * never logged here.
 */
class SmsReaderModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = "SmsReader"

  @ReactMethod
  fun setSenderCodes(codes: ReadableArray, promise: Promise) {
    SenderCodes.save(context, toSet(codes))
    promise.resolve(null)
  }

  /** Resolves to [{ sender, body, timestamp }] for bank senders, oldest first. */
  @ReactMethod
  fun readInbox(sinceMs: Double, codes: ReadableArray, promise: Promise) {
    try {
      val wanted = toSet(codes)
      val result = Arguments.createArray()
      context.contentResolver.query(
          Telephony.Sms.Inbox.CONTENT_URI,
          arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
          "${Telephony.Sms.DATE} > ?",
          arrayOf(sinceMs.toLong().toString()),
          "${Telephony.Sms.DATE} ASC",
      )?.use { cursor ->
        while (cursor.moveToNext()) {
          val address = cursor.getString(0) ?: continue
          if (SenderCodes.codeOf(address) !in wanted) continue
          val sms = Arguments.createMap()
          sms.putString("sender", address)
          sms.putString("body", cursor.getString(1) ?: "")
          sms.putDouble("timestamp", cursor.getLong(2).toDouble())
          result.pushMap(sms)
        }
      }
      promise.resolve(result)
    } catch (e: SecurityException) {
      promise.reject("NO_PERMISSION", "READ_SMS permission not granted")
    }
  }

  private fun toSet(codes: ReadableArray): Set<String> =
      (0 until codes.size()).mapNotNull { codes.getString(it)?.uppercase() }.toSet()
}
