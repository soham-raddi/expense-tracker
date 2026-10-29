package com.upitracker.sms

import android.content.Context

/**
 * Which SMS senders count as banks. JS pushes the list from src/config/banks.json
 * at startup so the live receiver can drop every other SMS before it reaches JS.
 */
object SenderCodes {
  private const val PREFS = "sms_sender_codes"
  private const val KEY = "codes"

  /** "VM-ICICIT" / "AD-ICICIB-S" / "ICICIB" -> "ICICIB". Mirrors senderCode() in src/ingest/registry.ts. */
  fun codeOf(address: String): String {
    val parts = address.uppercase().split("-")
    return if (parts.size >= 2) parts[1] else parts[0]
  }

  fun save(context: Context, codes: Set<String>) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putStringSet(KEY, codes)
        .apply()
  }

  fun load(context: Context): Set<String> =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
          .getStringSet(KEY, emptySet()) ?: emptySet()
}
