package com.upitracker.sms

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.SecureRandom

/** Random bytes from the OS for the database key (see src/data/dbKey.ts). */
class SecureRandomModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = "SecureRandom"

  @ReactMethod
  fun hexBytes(count: Double, promise: Promise) {
    val bytes = ByteArray(count.toInt())
    SecureRandom().nextBytes(bytes)
    promise.resolve(bytes.joinToString("") { "%02x".format(it) })
  }
}
