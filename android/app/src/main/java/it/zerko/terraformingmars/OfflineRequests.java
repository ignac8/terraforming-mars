package it.zerko.terraformingmars;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Answers the WebView's requests for anything off the phone, so that no page
 * ever waits on the network.
 *
 * The game's index.html links the Ubuntu font from Google Fonts as a
 * stylesheet, and the WebView draws nothing of a page until that stylesheet
 * has loaded or failed. Without internet, on a connection that does not
 * answer (mobile data with no signal, Wi-Fi with no uplink), that takes as
 * long as the network timeouts, and every page change looks stuck. So the
 * stylesheet and its font files are served from assets/fonts, a copy of what
 * Google Fonts serves a current Chrome (licence in assets/fonts/UFL.txt), and
 * every other request off the phone gets an empty 404 at once.
 */
final class OfflineRequests {
  private static final String FONTS = "fonts/";
  /** Fonts load in CORS mode, so the page on the loopback server needs this to use them. */
  private static final Map<String, String> CORS = Collections.singletonMap("Access-Control-Allow-Origin", "*");

  /** The off-device URLs already logged, so that each shows up once per process. */
  private static final Set<String> logged = new HashSet<>();

  private OfflineRequests() {
  }

  /** The response for a request that is not for the local server, or null to let the WebView load it. */
  static WebResourceResponse answer(Context context, Uri uri) {
    String scheme = uri.getScheme();
    if (!"http".equals(scheme) && !"https".equals(scheme)) {
      return null;
    }
    String host = uri.getHost();
    if ("fonts.googleapis.com".equals(host) && "Ubuntu".equals(uri.getQueryParameter("family"))) {
      return asset(context, uri, FONTS + "ubuntu.css", "text/css", "utf-8");
    }
    String file = uri.getLastPathSegment();
    if ("fonts.gstatic.com".equals(host) && file != null && file.endsWith(".woff2")) {
      return asset(context, uri, FONTS + file, "font/woff2", null);
    }
    return notFound(uri);
  }

  private static WebResourceResponse asset(Context context, Uri uri, String path, String mimeType, String encoding) {
    InputStream data;
    try {
      data = context.getAssets().open(path);
    } catch (IOException e) {
      return notFound(uri);
    }
    return new WebResourceResponse(mimeType, encoding, 200, "OK", CORS, data);
  }

  private static WebResourceResponse notFound(Uri uri) {
    synchronized (logged) {
      if (logged.add(uri.toString())) {
        AppLog.w("No network in the app; answered " + uri + " with 404");
      }
    }
    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", CORS, new ByteArrayInputStream(new byte[0]));
  }
}
