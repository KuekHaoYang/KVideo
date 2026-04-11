# KVideo Apple TV App

A lightweight tvOS WebView wrapper for KVideo.

## Requirements

- macOS with Xcode 15+
- Apple Developer account (free is fine for personal device sideloading)

## Setup

1. Open Xcode → **File → New → Project**
2. Select **tvOS → App**, click Next
3. Set:
   - Product Name: `KVideoTV`
   - Interface: **SwiftUI**
   - Language: **Swift**
4. Choose a save location, click Create
5. **Replace** the generated `KVideoTVApp.swift` with the one in this directory
6. **Replace** the generated `ContentView.swift` with the one in this directory
7. In `ContentView.swift`, change `kvideoURL` to your deployed KVideo instance URL:
   ```swift
   let kvideoURL = "https://your-kvideo-instance.com"
   ```
8. Set deployment target to **tvOS 16.0** or later
9. Connect your Apple TV (or use the tvOS Simulator)
10. Build and run (Cmd+R)

## How it works

- The app is a fullscreen `WKWebView` that loads your KVideo URL
- On page load, it injects `tv-mode` CSS class to activate TV-optimized styles
- The Apple TV remote's swipe gestures map to scroll, and click maps to tap/focus
- Back navigation uses `allowsBackForwardNavigationGestures`

## Notes

- Apple TV apps **cannot** be published to the App Store if they're just web wrappers
- This is intended for personal sideloading only
- For AirPlay: you can also just AirPlay from iPhone/iPad/Mac without needing this app
