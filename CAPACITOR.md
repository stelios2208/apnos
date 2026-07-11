# Apnos as a native app (Capacitor)

Apnos ships to the web as a TanStack Start SSR site, and to phones as a thin
[Capacitor](https://capacitorjs.com/) native shell. The shell loads the live
deployment in a native WebView and injects Capacitor's bridge, so native
plugins (starting with **Haptics**) work — this is what makes vibration
reliable, since native haptics don't depend on the browser's flaky Vibration
API.

## What's in the repo

- `capacitor.config.ts` — app id (`app.apnos`), name, and `server.url` (the
  production site the shell loads). **Change `server.url` to your own domain.**
- `src/lib/native.ts` — `isNativeApp()` + `nativeVibrate()`. Haptics route
  through the native plugin in the app and fall back to `navigator.vibrate`
  in a plain browser. Wired into `vibrate()` in `src/lib/trainer-fx.ts`, so
  every buzz across the trainers/warm-ups/planner uses it automatically.
- Capacitor deps are installed; native platform projects (`/android`, `/ios`)
  are **git-ignored** and generated locally.

## Build the Android app (on your machine)

Requires Android Studio + JDK 17.

```sh
npm install
npx cap add android      # one time — generates the android/ project
npx cap sync             # after any config/plugin change
npx cap open android     # opens Android Studio → Run / build APK/AAB
```

There is no web build step for the shell: it loads `server.url`, so just make
sure that URL is deployed and reachable. (npm scripts `cap:add:android`,
`cap:sync`, `cap:open:android` wrap the commands above.)

## iOS

Same flow on a Mac with Xcode: `npx cap add ios` → `npx cap open ios`.

## Going fully offline later

The shell needs network because it loads `server.url`. To bundle the app so it
runs offline, produce a static export of the front-end, point `webDir` at it,
remove `server.url` from `capacitor.config.ts`, and `npx cap sync`. That's a
larger change (the app currently relies on SSR) and is deliberately left as a
follow-up.
