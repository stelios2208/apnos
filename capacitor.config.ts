import type { CapacitorConfig } from "@capacitor/cli";

// Apnos is a TanStack Start SSR site, so the native shell loads the live
// deployment inside its WebView rather than bundling a static build. Capacitor
// still injects its native bridge into that page, so the Haptics plugin (and
// any future native plugin) works — this is what finally makes vibration
// reliable, since native haptics don't depend on the flaky web Vibration API.
//
// ▸ To ship a fully offline bundle later, drop `server.url`, point `webDir`
//   at a static export of the app, and run `npx cap sync`.
const config: CapacitorConfig = {
  appId: "app.apnos",
  appName: "Apnos",
  webDir: "public",
  server: {
    url: "https://apnos.app",
    androidScheme: "https",
    cleartext: false,
  },
  backgroundColor: "#020a13",
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      backgroundColor: "#020a13",
      showSpinner: false,
    },
  },
};

export default config;
