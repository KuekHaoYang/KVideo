package com.kvideo.tv

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.Rational
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebChromeClient.CustomViewCallback
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {

    companion object {
        private const val PREFS_NAME = "kvideo_tv_settings"
        private const val PREF_SERVER_URL = "server_url"
        private const val TAG = "KVideoMainActivity"
    }

    private lateinit var webView: WebView
    private lateinit var setupContainer: View
    private lateinit var fullscreenContainer: FrameLayout
    private lateinit var urlInput: EditText
    private lateinit var statusText: TextView
    private lateinit var openButton: Button
    private lateinit var saveButton: Button
    private lateinit var prefs: android.content.SharedPreferences
    private var customView: View? = null
    private var customViewCallback: CustomViewCallback? = null
    private var wasSetupVisibleBeforeFullscreen = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        applyImmersiveMode()

        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webview)
        setupContainer = findViewById(R.id.setup_container)
        fullscreenContainer = findViewById(R.id.fullscreen_container)
        urlInput = findViewById(R.id.url_input)
        statusText = findViewById(R.id.status_text)
        openButton = findViewById(R.id.open_button)
        saveButton = findViewById(R.id.save_button)

        saveButton.setOnClickListener {
            openConfiguredUrl()
        }
        urlInput.setOnEditorActionListener { _, actionId, event ->
            val isKeyboardConfirmAction = actionId == EditorInfo.IME_NULL ||
                actionId == EditorInfo.IME_ACTION_DONE ||
                actionId == EditorInfo.IME_ACTION_GO ||
                actionId == EditorInfo.IME_ACTION_SEND ||
                actionId == EditorInfo.IME_ACTION_NEXT
            val isEnterKey = event?.action == KeyEvent.ACTION_DOWN && (
                event.keyCode == KeyEvent.KEYCODE_ENTER ||
                    event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
                )

            if (isKeyboardConfirmAction || isEnterKey) {
                openConfiguredUrl()
                true
            } else {
                false
            }
        }

        webView.apply {
            setLayerType(View.LAYER_TYPE_HARDWARE, null)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                databaseEnabled = true
            }

            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                    if (view == null || callback == null) {
                        callback?.onCustomViewHidden()
                        return
                    }

                    if (customView != null) {
                        callback.onCustomViewHidden()
                        return
                    }

                    wasSetupVisibleBeforeFullscreen = isSetupVisible()
                    customView = view
                    customViewCallback = callback

                    fullscreenContainer.removeAllViews()
                    fullscreenContainer.addView(
                        view,
                        FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                    fullscreenContainer.visibility = View.VISIBLE
                    webView.visibility = View.GONE
                    setupContainer.visibility = View.GONE
                    applyImmersiveMode()
                }

                override fun onHideCustomView() {
                    exitCustomFullscreen()
                }
            }
            addJavascriptInterface(AndroidPlayerBridge(), "KVideoAndroid")
        }

        val configuredUrl = getConfiguredUrl()
        if (configuredUrl.isNotEmpty()) {
            urlInput.setText(configuredUrl)
            loadConfiguredUrl(configuredUrl)
        } else {
            showSetup(getString(R.string.status_first_launch))
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (!isSetupVisible() && keyCode == KeyEvent.KEYCODE_BACK && customView != null) {
            exitCustomFullscreen()
            return true
        }

        if (!isSetupVisible() && (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_SETTINGS)) {
            showSetup(getString(R.string.status_settings_hint))
            return true
        }

        // Map D-pad center to Enter for spatial navigation
        if (!isSetupVisible() && keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
            webView.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (!isSetupVisible() && keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
            webView.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    @Deprecated("Use OnBackPressedDispatcher")
    override fun onBackPressed() {
        if (customView != null) {
            exitCustomFullscreen()
            return
        }

        if (isSetupVisible()) {
            @Suppress("DEPRECATION")
            super.onBackPressed()
            return
        }

        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            showSetup(getString(R.string.status_settings_hint))
        }
    }

    override fun onResume() {
        super.onResume()
        applyImmersiveMode()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applyImmersiveMode()
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (!isInPictureInPictureMode) {
            applyImmersiveMode()
        }
    }

    override fun onDestroy() {
        exitCustomFullscreen()
        webView.destroy()
        super.onDestroy()
    }

    private fun openConfiguredUrl() {
        val normalizedUrl = normalizeUrl(urlInput.text.toString())
        if (!isValidUrl(normalizedUrl)) {
            statusText.text = getString(R.string.status_invalid_url)
            urlInput.requestFocus()
            return
        }

        prefs.edit().putString(PREF_SERVER_URL, normalizedUrl).apply()
        loadConfiguredUrl(normalizedUrl)
    }

    private fun loadConfiguredUrl(url: String) {
        setupContainer.visibility = View.GONE
        statusText.text = getString(R.string.status_ready)
        webView.loadUrl(url)
    }

    private fun showSetup(message: String) {
        val currentUrl = getConfiguredUrl()
        if (currentUrl.isNotEmpty() && urlInput.text.toString().isBlank()) {
            urlInput.setText(currentUrl)
        }

        if (currentUrl.isNotEmpty()) {
            openButton.text = getString(R.string.button_open_saved)
            openButton.setOnClickListener {
                urlInput.setText(currentUrl)
                loadConfiguredUrl(currentUrl)
            }
        } else {
            openButton.text = getString(R.string.button_exit)
            openButton.setOnClickListener {
                finish()
            }
        }

        statusText.text = message
        setupContainer.visibility = View.VISIBLE
        urlInput.requestFocus()
    }

    private fun getConfiguredUrl(): String {
        val savedUrl = prefs.getString(PREF_SERVER_URL, null)?.trim().orEmpty()
        if (isValidUrl(savedUrl)) {
            return savedUrl
        }

        val defaultUrl = normalizeUrl(BuildConfig.DEFAULT_KVIDEO_URL)
        return if (isValidUrl(defaultUrl)) defaultUrl else ""
    }

    private fun isSetupVisible(): Boolean = setupContainer.visibility == View.VISIBLE

    private fun normalizeUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        if (trimmed.isEmpty()) {
            return ""
        }

        val withScheme = if (
            trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true)
        ) {
            trimmed
        } else {
            "https://$trimmed"
        }

        return withScheme.removeSuffix("/")
    }

    private fun isValidUrl(url: String): Boolean {
        if (url.isBlank()) {
            return false
        }

        val uri = Uri.parse(url)
        val scheme = uri.scheme?.lowercase()
        return (scheme == "http" || scheme == "https") && !uri.host.isNullOrBlank()
    }

    private fun applyImmersiveMode() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )
    }

    private fun exitCustomFullscreen() {
        val currentCustomView = customView ?: return
        fullscreenContainer.removeView(currentCustomView)
        fullscreenContainer.visibility = View.GONE
        customView = null
        webView.visibility = View.VISIBLE
        if (wasSetupVisibleBeforeFullscreen) {
            setupContainer.visibility = View.VISIBLE
        }
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        wasSetupVisibleBeforeFullscreen = false
        applyImmersiveMode()
    }

    private fun isPictureInPictureSupported(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return false
        }

        return packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
    }

    private inner class AndroidPlayerBridge {
        @JavascriptInterface
        fun isPictureInPictureSupported(): Boolean = isPictureInPictureSupported()

        @JavascriptInterface
        fun enterPictureInPicture(width: Int, height: Int): Boolean {
            if (!isPictureInPictureSupported()) {
                return false
            }

            runOnUiThread {
                try {
                    exitCustomFullscreen()
                    val builder = android.app.PictureInPictureParams.Builder()
                    if (width > 0 && height > 0) {
                        builder.setAspectRatio(Rational(width, height))
                    }
                    enterPictureInPictureMode(builder.build())
                } catch (error: IllegalStateException) {
                    Log.w(TAG, "Failed to enter Picture-in-Picture mode", error)
                }
            }

            return true
        }
    }
}
