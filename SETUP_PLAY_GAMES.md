# Setting up Play Games cloud save (Nut & Bolt Sort)

Cloud save is **scaffolding only** and **OFF by default**. Nothing talks to Play Games until every step below is done and `ENABLED` is set to `true`. No real IDs are in the repo; the placeholders must be replaced with the values from John's own Play Console.

## What's already in the code
- `www/js/cloud-config.js`: `ENABLED: false`, `PLAY_GAMES_APP_ID: 'REPLACE_WITH_PLAY_GAMES_APP_ID'`, the snapshot name, and the whitelist of localStorage keys that get backed up (`nutboltsort.save.v1`, the daily key, `nutboltsort.ach.v1`).
- `www/js/cloudsave.js`: builds a snapshot of the whitelisted keys, uses newest-wins conflict handling (no partial merges, so coins can't duplicate), restores only whitelisted keys, and has a Settings button "Cloud save (Play Games)" that stays hidden unless enabled.
- Unit tests in `test/v15.test.js` check that cloud save is OFF by default, that only placeholder IDs are used, and that the whitelist is enforced.

## What John needs to do / provide
1. **Play Console developer account** with the app created. Package: `com.offerpk.nutboltsort`.
2. **Play Games Services → Setup and management → Configuration**: create a Play Games Services project for this game.
   - Copy the numeric **App ID** (the "Project ID" shown as *App ID*, around 12 digits). This goes into `PLAY_GAMES_APP_ID`.
   - Turn on **Saved Games** in the configuration.
3. **Credentials → Add credential → Android**: link the package name and the **SHA-1 of the app signing key**.
   - Use the SHA-1 from Play Console → Setup → App integrity (Play App Signing).
   - If you also test with the upload key, add a second credential with the upload-key SHA-1 (from the keystore used in CI's `KEYSTORE_BASE64` secret).
4. **Testers**: under Play Games Services → Testers, add the Google accounts that will test before publishing.
5. **Publish** the Play Games Services configuration (Review and publish) when testing is done.

## Developer steps after John provides the App ID
1. Add a native bridge plugin that exposes `signIn()`, `save({name,json,description})` and `load({name})` as `Capacitor.Plugins.PlayGamesSaves`. It can be a small custom Capacitor plugin using `com.google.android.gms:play-services-games-v2` (PlayGames.getSnapshotsClient), or a community plugin wrapped to that interface.
2. Add to `android/app/src/main/res/values/strings.xml`: `<string name="game_services_project_id" translatable="false">APP_ID_HERE</string>`
3. Add to `AndroidManifest.xml` inside `<application>`: `<meta-data android:name="com.google.android.gms.games.APP_ID" android:value="@string/game_services_project_id"/>`
4. Set `PLAY_GAMES_APP_ID` and `ENABLED: true` in `www/js/cloud-config.js`. Update `PRIVACY.md`/privacy.html and the Data safety form (see `store/DATA-SAFETY-v1.5.md`).
5. Test on a real device signed with a key whose SHA-1 is registered: back up, uninstall, reinstall, launch (it auto-restores), then check coins, levels and skins.

## In-app review (already active, no IDs needed)
`@capacitor-community/in-app-review` uses Google's In-App Review API. It is asked only after the 3rd+ win, only from a win/result screen, at most once every 30 days. Google decides whether the sheet appears. It never appears for sideloaded APKs, only for installs from Play, including internal and closed testing tracks.
