package com.expensetracker.sms

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException
import com.tom_roush.pdfbox.text.PDFTextStripper

/**
 * Lets the user pick a statement PDF and reads its text on the phone. The file is only opened
 * through Android's file picker (no storage permission) and nothing is copied or kept.
 */
class StatementReaderModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), ActivityEventListener {

  private var pending: Promise? = null

  init {
    context.addActivityEventListener(this)
    PDFBoxResourceLoader.init(context)
  }

  override fun getName() = "StatementReader"

  /** Opens the system file picker. Resolves with the file's URI, or null if cancelled. */
  @ReactMethod
  fun pickPdf(promise: Promise) {
    val activity = context.currentActivity
    if (activity == null || pending != null) {
      promise.reject("NO_ACTIVITY", "Could not open the file picker")
      return
    }
    pending = promise
    val intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "application/pdf"
        }
    activity.startActivityForResult(intent, PICK_REQUEST)
  }

  /** Resolves with the PDF's text. Rejects with PASSWORD_REQUIRED, WRONG_PASSWORD or UNREADABLE. */
  @ReactMethod
  fun readText(uri: String, password: String, promise: Promise) {
    Thread {
          try {
            val stream = context.contentResolver.openInputStream(Uri.parse(uri))
            if (stream == null) {
              promise.reject("UNREADABLE", "Could not open the file")
              return@Thread
            }
            stream.use {
              PDDocument.load(it, password).use { doc ->
                val stripper = PDFTextStripper()
                stripper.sortByPosition = true
                promise.resolve(stripper.getText(doc))
              }
            }
          } catch (e: InvalidPasswordException) {
            promise.reject(if (password.isEmpty()) "PASSWORD_REQUIRED" else "WRONG_PASSWORD", "Password")
          } catch (e: Exception) {
            promise.reject("UNREADABLE", "Could not read this PDF")
          }
        }
        .start()
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != PICK_REQUEST) return
    val promise = pending ?: return
    pending = null
    promise.resolve(if (resultCode == Activity.RESULT_OK) data?.data?.toString() else null)
  }

  override fun onNewIntent(intent: Intent) {}

  companion object {
    private const val PICK_REQUEST = 7401
  }
}
