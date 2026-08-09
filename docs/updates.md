# Desktop updates

Kea uses the Tauri updater plugin for signed in-app updates. The Settings dialog checks the static `latest.json` asset attached to the latest GitHub release and can download, install, and relaunch Kea.

The release workflow runs for `v*.*.*` tags on macOS only. Before publishing the first release, configure these repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: the private key paired with the public key in `src-tauri/tauri.conf.json`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the key password, if one was set.

The private key must never be committed. If it is lost, existing installed versions cannot verify future updates.
