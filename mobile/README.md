# Career Compass — Cross-Platform Mobile Companion (React Native / Expo) 📱

> **Interactive Mock Interview Simulator & 3-Month Roadmap Checklist on Mobile**  
> *Aligned with Phase 3 (Section 7.2) of Career Compass Technical Specification*

---

## 🌟 Overview
The Career Compass Mobile App allows users to take their career preparation anywhere on iOS and Android devices:
1. Create an account, upload a PDF CV, review extracted data, complete the assessment, and view analysis and history.
2. Practice a text or voice interview and update the latest roadmap.
3. Manage candidate sharing consent and, where authorized, company jobs, candidates, team membership and company reviews.

An analysis is required before starting an interview. Microphone permission is required for voice answers. Analysis drafts are stored in secure device storage per account; if secure storage or profile loading fails, the app warns that the draft may not be saved. Company administration and member names require the matching backend routes to be deployed.

---

## 🚀 Running the Mobile App (Expo)

### Prerequisites
- A Node.js version supported by the installed Expo SDK
- Expo Go app on your physical iOS or Android device (optional)

### Setup & Launch
```bash
cd mobile
npm install
npx expo start
```
Run `node --test tests/*.test.cjs` to check mobile service logic. Run `npx expo export --platform all` to validate Android and iOS bundles. These checks do not replace testing on physical devices.
The default API address works with an Android emulator or local iOS simulator. For a physical device, add `EXPO_PUBLIC_API_BASE_URL=https://your-server/api` to `mobile/.env` before starting Expo. Use an HTTPS address for a public server. Restart Expo after changing the address.
- Press `a` for Android Emulator.
- Press `i` for iOS Simulator.
- Press `w` for Web Preview.
- Or scan the terminal QR code with the **Expo Go** app on your phone!

## Release preparation

`eas.json` contains an internal preview profile (Android APK) and a production profile (Android App Bundle / iOS store build). The provisional Android application ID and iOS bundle identifier are `com.careercompass.mobile`; confirm their availability in the store accounts before the first release. The project is linked to Expo in `app.json`, and EAS manages the Android signing key. Do not change identifiers or lose the signing key after publishing without planning a separate app release.

Set `EXPO_PUBLIC_API_BASE_URL` to the device-accessible HTTPS API address, including `/api` when using the production proxy, in the EAS environment for each build profile. The preview environment is configured; configure production separately before a production build. The EAS pre-install check rejects a missing or insecure address; the ignored local `.env` is not a reliable cloud-build configuration. In PowerShell, run the following from `mobile` to upload only the mobile project and build a test APK:

```powershell
$env:EAS_NO_VCS = '1'
$env:EAS_PROJECT_ROOT = (Get-Location).Path
npx eas-cli build --platform android --profile preview
```

Use the `production` profile for store builds. iOS builds and distribution require an Apple developer account and appropriate signing. The mobile `.easignore` excludes local environment files and dependency directories.

Install and test both device builds before publishing: login and session expiry, PDF selection and analysis, draft restoration, interview recording, consent withdrawal, company isolation, invitations and owner-only actions. Deploy the compatible backend routes separately before testing member names.
