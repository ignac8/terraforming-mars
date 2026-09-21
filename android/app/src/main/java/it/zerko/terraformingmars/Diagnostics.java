package it.zerko.terraformingmars;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.system.Os;
import android.system.OsConstants;
import android.text.TextUtils;

import androidx.core.content.FileProvider;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * The diagnostics bundle: a zip of the server and app logs, this process's
 * logcat lines, the device details and the saved games, built in the cache
 * folder and handed to the share sheet so it can be sent from the phone.
 */
final class Diagnostics {
  private static final String[] LOG_FILES = {"server.log", "server.log.1", "app.log", "app.log.1"};
  private static final SimpleDateFormat STAMP = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US);

  private Diagnostics() {
  }

  /** Builds the bundle, replacing any earlier one, and returns the zip file. */
  static File create(Context context) throws IOException {
    File projectDir = ProjectInstaller.projectDir(context);
    File dir = new File(context.getCacheDir(), "diagnostics");
    if (!dir.isDirectory() && !dir.mkdirs()) {
      throw new IOException("Cannot create " + dir);
    }
    for (File old : listOrEmpty(dir)) {
      if (!old.delete()) {
        AppLog.w("Cannot delete the earlier bundle " + old);
      }
    }
    File zipFile = new File(dir, "terraforming-mars-diagnostics-" + STAMP.format(new Date()) + ".zip");
    try (ZipOutputStream zip = new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(zipFile)))) {
      putText(zip, "info.txt", info());
      File logs = new File(projectDir, "logs");
      for (String name : LOG_FILES) {
        File file = new File(logs, name);
        if (file.isFile()) {
          putFile(zip, "logs/" + name, file);
        }
      }
      putText(zip, "logcat.txt", logcat());
      for (File game : listOrEmpty(new File(projectDir, "db/files"))) {
        if (game.isFile() && game.getName().endsWith(".json")) {
          putFile(zip, "games/" + game.getName(), game);
        }
      }
    }
    return zipFile;
  }

  /** The share sheet for a bundle from {@link #create}. */
  static Intent shareIntent(Context context, File zipFile) {
    Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".diagnostics", zipFile);
    Intent send = new Intent(Intent.ACTION_SEND)
        .setType("application/zip")
        .putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_SUBJECT, zipFile.getName())
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    return Intent.createChooser(send, context.getString(R.string.share_diagnostics));
  }

  private static String info() {
    return "app " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")\n"
        + "android " + Build.VERSION.RELEASE + " (api " + Build.VERSION.SDK_INT + ")\n"
        + "device " + Build.MANUFACTURER + " " + Build.MODEL + "\n"
        + "abis " + TextUtils.join(",", Build.SUPPORTED_ABIS) + "\n"
        + "page size " + Os.sysconf(OsConstants._SC_PAGESIZE) + "\n"
        + "time " + new Date() + "\n";
  }

  /** This process's logcat lines; an app may read its own without any permission. */
  private static String logcat() {
    try {
      Process process = new ProcessBuilder("logcat", "-d", "-v", "threadtime", "--pid=" + android.os.Process.myPid())
          .redirectErrorStream(true)
          .start();
      try (InputStream in = process.getInputStream()) {
        return new String(readAll(in), StandardCharsets.UTF_8);
      }
    } catch (IOException e) {
      return "logcat unavailable: " + e + "\n";
    }
  }

  private static void putText(ZipOutputStream zip, String name, String text) throws IOException {
    zip.putNextEntry(new ZipEntry(name));
    zip.write(text.getBytes(StandardCharsets.UTF_8));
    zip.closeEntry();
  }

  private static void putFile(ZipOutputStream zip, String name, File file) throws IOException {
    zip.putNextEntry(new ZipEntry(name));
    try (InputStream in = new FileInputStream(file)) {
      byte[] buffer = new byte[64 * 1024];
      int read;
      while ((read = in.read(buffer)) != -1) {
        zip.write(buffer, 0, read);
      }
    }
    zip.closeEntry();
  }

  private static byte[] readAll(InputStream in) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buffer = new byte[64 * 1024];
    int read;
    while ((read = in.read(buffer)) != -1) {
      out.write(buffer, 0, read);
    }
    return out.toByteArray();
  }

  private static File[] listOrEmpty(File dir) {
    File[] children = dir.listFiles();
    return children == null ? new File[0] : children;
  }
}
