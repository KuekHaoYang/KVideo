import SwiftUI
import WebKit

/// Change this to your deployed KVideo instance URL
let kvideoURL = "https://kvideo.example.com"

struct ContentView: View {
    var body: some View {
        WebView(url: URL(string: kvideoURL)!)
            .ignoresSafeArea()
    }
}

struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        config.defaultWebpagePreferences = preferences

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black

        // Allow back navigation via Menu button
        webView.allowsBackForwardNavigationGestures = true

        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Inject JS to signal TV mode
            webView.evaluateJavaScript("""
                document.body.classList.add('tv-mode');
            """)
        }
    }
}
