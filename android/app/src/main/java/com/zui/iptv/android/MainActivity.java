package com.zui.iptv.android;

import android.os.Bundle;
import android.os.Handler;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.zui.iptv.android.NativePlayerPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(NativePlayerPlugin.class);
    super.onCreate(savedInstanceState);
    new Handler().postDelayed(() -> {
      try {
        WebView webView = getBridge().getWebView();
        WebSettings s = webView.getSettings();
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
      } catch (Exception e) {
        // ignora
      }
    }, 800);
  }
}
