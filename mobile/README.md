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

Set `EXPO_PUBLIC_API_BASE_URL` to the device-accessible HTTPS API address, including `/api` when using the production proxy, in the EAS environment for each build profile. Both preview and production environments were configured on 2026-11-15; verify the address before a release. The EAS pre-install check rejects a missing or insecure address; the ignored local `.env` is not a reliable cloud-build configuration. In PowerShell, run the following from `mobile` to upload only the mobile project and build a test APK:

```powershell
$env:EAS_NO_VCS = '1'
$env:EAS_PROJECT_ROOT = (Get-Location).Path
npx eas-cli build --platform android --profile preview
```

Use the `production` profile for store builds. iOS builds and distribution require an Apple developer account and appropriate signing. The mobile `.easignore` excludes local environment files and dependency directories.

Install and test both device builds before publishing: login and session expiry, PDF selection and analysis, draft restoration, interview recording, consent withdrawal, company isolation, invitations and owner-only actions. Deploy the compatible backend routes separately before testing member names.

### Verification on 2026-11-15

- Mobile: 28 automated service and screen-handler tests passed, and both Android and iOS bundles exported. The screen tests stub native widgets and APIs; they do not verify rendering, keyboard behavior, recording quality or permissions on a phone.
- Changes include cross-platform safe areas, iOS keyboard avoidance, Arabic labels, session recovery, Android back handling, voice-upload retry, job-specific candidate notes, and confirmed account deletion from Profile. Company/platform owners cannot delete their account while they own records; the backend enforces this restriction.
- Android preview version code 2 uses the existing Expo Android keystore. The final build [151a6936-c8c0-4ee5-8e97-0e3c0ea49c5d](https://expo.dev/accounts/akram3005/projects/career-compass-mobile/builds/151a6936-c8c0-4ee5-8e97-0e3c0ea49c5d) finished successfully on 2026-11-15. [Download the APK](https://expo.dev/artifacts/eas/BbXkH3lQxsSdewG8AX3ANdQQeM_DZ2wAttpreTa261w.apk). Build `f31ff2d2-8685-4389-87d0-60e7b798aa7a` was canceled because it preceded the Android back fixes.
- Downloaded APK passed ZIP integrity checking and contains `com.careercompass.mobile` with `https://129.159.143.77/api` embedded in the app bundle. SHA-256: `2690ca1a957f35afb9c0fd2163875584bad54527efd061e04c236222d5af02a3`. The local copy is `mobile/dist/CareerCompass-preview-2.apk` (ignored by Git). This inspection does not prove installation or phone behavior.
- Backend: 174 tests passed at the initial clean checkout, before concurrent local backend work appeared. Four focused consent/company-isolation tests also passed against the release image in an isolated container on Oracle. These results do not certify subsequent concurrent changes.
- Oracle: the deployed API code was compared with server files before updating. Only `backend/app/services/recruiter_service.py`, `frontend/src/api/endpoints.js` and `frontend/src/pages/recruiter/RecruiterPortal.jsx` were deployed. The server-specific Nginx configuration was preserved. Other concurrent local changes were not included.
- Backup: `/home/opc/career-compass-backup-20261115-fq9um3lf` contains SQL, MongoDB, uploads, previous source/configuration and image IDs. The directory is private (0700), files are 0600, and archive/dump integrity checks passed. A full restore rehearsal was not performed. Existing backups were retained.
- After deployment: HTTPS health reported SQL/Mongo healthy, Celery replied `pong`, API/worker/beat used the same image, frontend returned 200, and protected routes returned 401 without a token. Compared user/company/extraction/analysis/consent counts were unchanged. This does not verify authenticated phone journeys.
- `npm audit --json` reported 20 affected packages, all moderate, propagated from one [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) through Expo tooling. No high/critical findings were reported. Installed `@expo/fingerprint` uses the default optimization level 1, while the reported amplification requires level 2 or higher. No forced major dependency override was applied; recheck before release.

Store release remains pending: there is no Apple Developer membership, Apple signing and bundle-ID availability have not been verified, and no store build or submission was made. Public privacy/account-deletion URLs, store privacy declarations, review access and device screenshots still need preparation and review. Real-device login, CV upload, microphone/background interruptions, invitations, consent withdrawal and tenant/owner journeys remain unverified; device testing was deferred until after implementation at the user's request.
