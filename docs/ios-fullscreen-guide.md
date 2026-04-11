# iOS Fullscreen Guide

## Why can't I switch fullscreen modes?

Previously, the player forced **Web Fullscreen** (Custom UI) on all iOS devices to provide advanced features like Danmaku and custom controls. This prevented the "System Fullscreen" option in settings from working even if selected.

**We have now fixed this behavior.** You can now switch between the two modes in the player settings.

---

## Fullscreen Modes Explained

### 1. System Fullscreen (Native)
**Default behavior on iOS.** Best for standard playback, AirPlay, Picture-in-Picture.

- **Pros:**
  - Uses the native iOS video player.
  - Smoothest performance and battery life.
  - Native support for **AirPlay** and **Picture-in-Picture (PiP)**.
  - Familiar iOS gestures (pinch to zoom, etc.).
- **Cons:**
  - **No Danmaku (Bullet Comments)** in fullscreen.
  - Custom subtitle styling may be limited.
  - Default iOS controls instead of KVideo's custom controls.

### 2. Web Fullscreen (Window/Custom)
**Best for:** Danmaku, Advanced Controls, Subtitles.

- **Pros:**
  - **Danmaku works in fullscreen!**
  - Uses KVideo's custom interface and controls.
  - Better subtitle styling and positioning.
  - Quick access to playback speed, quality, and episode selection without leaving fullscreen.
- **Cons:**
  - **Address Bar Issue:** On some iPhones, the Safari address bar may not disappear completely in landscape mode, requiring manual hiding (scrolling up) or adding the app to the Home Screen.
  - **Not true fullscreen:** It's actually a "rotated" web page element that fills the screen (hence why it's sometimes called "Window Fullscreen" or "Fake Fullscreen").
  - Native gestures like standard PiP might require an extra tap.

---

## How to Switch

1. Open a video in the player.
2. Tap the **Settings (Gear Icon)** in the top right corner.
3. Tap **Fullscreen Mode** (全屏方式) to cycle through:
   - **Auto (Default)**:
     - **Mobile**: Uses Web Fullscreen.
     - **Desktop**: Uses System Fullscreen.
   - **System Fullscreen** (系统全屏) - Standard Experience
   - **Web Fullscreen** (网页全屏) - Enhanced Experience (Danmaku)
5. Tap the Fullscreen button on the video player to enter fullscreen.

> **Note for iOS Users:** If "Web Fullscreen" feels buggy (e.g., orientation issues), try locking your phone's orientation to Portrait before entering fullscreen, or switch to "System Fullscreen" for a more stable experience.
