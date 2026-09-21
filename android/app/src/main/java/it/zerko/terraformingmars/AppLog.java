package it.zerko.terraformingmars;

import android.util.Log;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.Writer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * The Android side's log: logcat, plus logs/app.log inside the project
 * folder, which the diagnostics bundle picks up when there is no adb around.
 * The file is rotated to app.log.1 past 1 MB.
 */
final class AppLog {
  static final String TAG = "TerraformingMars";
  private static final long LIMIT = 1024 * 1024;
  private static final SimpleDateFormat TIMESTAMP = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US);

  private static File file;

  private AppLog() {
  }

  static synchronized void init(File logDir) {
    if (!logDir.isDirectory() && !logDir.mkdirs()) {
      Log.w(TAG, "Cannot create " + logDir + "; the app log stays in logcat only");
      return;
    }
    file = new File(logDir, "app.log");
  }

  static void i(String message) {
    Log.i(TAG, message);
    append("I", message);
  }

  static void w(String message) {
    Log.w(TAG, message);
    append("W", message);
  }

  static void e(String message, Throwable error) {
    Log.e(TAG, message, error);
    append("E", error == null ? message : message + "\n" + Log.getStackTraceString(error));
  }

  private static synchronized void append(String level, String message) {
    if (file == null) {
      return;
    }
    try {
      if (file.length() > LIMIT && !file.renameTo(new File(file.getPath() + ".1"))) {
        Log.w(TAG, "Cannot rotate " + file);
      }
      try (Writer out = new FileWriter(file, true)) {
        out.write(TIMESTAMP.format(new Date()) + " " + level + " " + message + "\n");
      }
    } catch (IOException e) {
      Log.w(TAG, "Cannot write " + file, e);
    }
  }
}
