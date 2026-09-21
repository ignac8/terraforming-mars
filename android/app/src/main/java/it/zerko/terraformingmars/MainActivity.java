package it.zerko.terraformingmars;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.ServerSocket;
import java.net.URL;

/**
 * A full-screen WebView on the game server that NodeRuntime runs inside this
 * process. The last page is remembered so that reopening the app lands back
 * in the game that was being played. A game page has no links out of it,
 * so the round corner button opens a menu: the main menu, the saved games
 * (the admin games overview, one join link per seat), the admin panel and
 * the diagnostics bundle, which the screen shown when the server fails to
 * start also offers.
 */
public class MainActivity extends Activity {
  private static final String PREFERENCES = "terraforming-mars";
  private static final String LAST_PATH = "lastPath";
  /** The server id main.js gives the embedded server; the admin routes ask for it. */
  private static final String SERVER_ID = "offline";
  private static final String ADMIN_PATH = "/admin?serverId=" + SERVER_ID;
  private static final String SAVED_GAMES_PATH = "/games-overview?serverId=" + SERVER_ID;
  private static final long SERVER_TIMEOUT_MS = 90_000;

  /** The port the server listens on, chosen once per process. */
  private static int port = 0;

  private WebView webView;
  private View loading;
  private TextView status;
  private View menuButton;
  private View shareButton;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    AppLog.init(new File(ProjectInstaller.projectDir(this), "logs"));
    AppLog.i("Activity created, app " + BuildConfig.VERSION_NAME);

    webView = findViewById(R.id.webview);
    loading = findViewById(R.id.loading);
    status = findViewById(R.id.status);
    menuButton = findViewById(R.id.menu_button);
    shareButton = findViewById(R.id.share_button);
    menuButton.setOnClickListener(this::showMenu);
    shareButton.setOnClickListener((view) -> shareDiagnostics());
    configure(webView);

    new Thread(this::startServerAndOpen, "server-boot").start();
  }

  private void configure(WebView view) {
    WebSettings settings = view.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    // The game lays itself out for a 1260px-wide desktop viewport; scale it
    // to the screen and let the player pinch-zoom, as a phone browser would.
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setSupportZoom(true);
    settings.setBuiltInZoomControls(true);
    settings.setDisplayZoomControls(false);
    view.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (isLocalServer(uri)) {
          return false;
        }
        // Links out of the game (rules, GitHub, Discord) go to the system browser.
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (RuntimeException e) {
          AppLog.e("No app can open " + uri, e);
        }
        return true;
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        Uri uri = Uri.parse(url);
        if (isLocalServer(uri)) {
          String path = uri.getPath() + (uri.getQuery() == null ? "" : "?" + uri.getQuery());
          preferences().edit().putString(LAST_PATH, path).apply();
        }
      }
    });
    // The client's console (JavaScript errors included) goes to the app log.
    view.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onConsoleMessage(ConsoleMessage message) {
        String line = "web " + message.messageLevel() + " " + message.message()
            + " (" + message.sourceId() + ":" + message.lineNumber() + ")";
        if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
          AppLog.e(line, null);
        } else {
          AppLog.i(line);
        }
        return true;
      }
    });
  }

  private void showMenu(View anchor) {
    PopupMenu menu = new PopupMenu(this, anchor);
    menu.getMenuInflater().inflate(R.menu.corner_menu, menu.getMenu());
    menu.setOnMenuItemClickListener((item) -> {
      int id = item.getItemId();
      if (id == R.id.menu_main) {
        webView.loadUrl(serverUrl("/"));
      } else if (id == R.id.menu_saved_games) {
        webView.loadUrl(serverUrl(SAVED_GAMES_PATH));
      } else if (id == R.id.menu_admin) {
        webView.loadUrl(serverUrl(ADMIN_PATH));
      } else if (id == R.id.menu_diagnostics) {
        shareDiagnostics();
      } else {
        return false;
      }
      return true;
    });
    menu.show();
  }

  private static boolean isLocalServer(Uri uri) {
    return "http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost()) && uri.getPort() == port;
  }

  private void startServerAndOpen() {
    try {
      synchronized (MainActivity.class) {
        if (port == 0) {
          port = pickFreePort();
        }
      }
      NodeRuntime.start(ProjectInstaller.install(this), port, getCacheDir());
      waitForServer();
      AppLog.i("Server answering on port " + port);
    } catch (IOException | InterruptedException e) {
      AppLog.e("The game server did not start", e);
      runOnUiThread(() -> {
        status.setText(getString(R.string.server_failed, e.getMessage()));
        shareButton.setVisibility(View.VISIBLE);
      });
      return;
    }
    String path = preferences().getString(LAST_PATH, "/");
    runOnUiThread(() -> {
      loading.setVisibility(View.GONE);
      webView.setVisibility(View.VISIBLE);
      menuButton.setVisibility(View.VISIBLE);
      webView.loadUrl(serverUrl(path));
    });
  }

  /** Builds the diagnostics zip off the UI thread, then opens the share sheet for it. */
  private void shareDiagnostics() {
    new Thread(() -> {
      try {
        File zip = Diagnostics.create(this);
        AppLog.i("Diagnostics bundle " + zip.getName() + ", " + zip.length() + " bytes");
        runOnUiThread(() -> startActivity(Diagnostics.shareIntent(this, zip)));
      } catch (IOException | RuntimeException e) {
        AppLog.e("Cannot build the diagnostics bundle", e);
        runOnUiThread(() -> Toast.makeText(this, getString(R.string.diagnostics_failed, e.getMessage()), Toast.LENGTH_LONG).show());
      }
    }, "diagnostics").start();
  }

  private static int pickFreePort() throws IOException {
    try (ServerSocket socket = new ServerSocket(0)) {
      socket.setReuseAddress(true);
      return socket.getLocalPort();
    }
  }

  private void waitForServer() throws IOException, InterruptedException {
    long deadline = System.currentTimeMillis() + SERVER_TIMEOUT_MS;
    IOException last = null;
    while (System.currentTimeMillis() < deadline) {
      try {
        HttpURLConnection connection = (HttpURLConnection) new URL(serverUrl("/")).openConnection();
        connection.setConnectTimeout(1000);
        connection.setReadTimeout(2000);
        int code = connection.getResponseCode();
        connection.disconnect();
        if (code == 200) {
          return;
        }
      } catch (IOException e) {
        last = e;
      }
      Thread.sleep(250);
    }
    throw new IOException("no answer on port " + port + " after " + (SERVER_TIMEOUT_MS / 1000) + "s", last);
  }

  private static String serverUrl(String path) {
    return "http://127.0.0.1:" + port + path;
  }

  private SharedPreferences preferences() {
    return getSharedPreferences(PREFERENCES, MODE_PRIVATE);
  }

  @Override
  public boolean onKeyDown(int keyCode, KeyEvent event) {
    if (keyCode == KeyEvent.KEYCODE_BACK && webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
      webView.goBack();
      return true;
    }
    return super.onKeyDown(keyCode, event);
  }
}
