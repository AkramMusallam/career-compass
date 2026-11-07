# Career Compass — Cross-Platform Mobile Companion (React Native / Expo) 📱

> **Interactive Mock Interview Simulator & 3-Month Roadmap Checklist on Mobile**  
> *Aligned with Phase 3 (Section 7.2) of Career Compass Technical Specification*

---

## 🌟 Overview
The Career Compass Mobile App allows users to take their career preparation anywhere on iOS and Android devices:
1. Sign in with an existing Career Compass account.
2. Practice a text or voice interview based on your latest analysis.
3. View and update your latest roadmap while connected to the backend.

Create an analysis on the web before starting an interview. Microphone permission is required for voice answers.

---

## 🚀 Running the Mobile App (Expo)

### Prerequisites
- Node.js (v18+)
- Expo CLI: `npm install -g expo-cli` (or run via `npx expo`)
- Expo Go app on your physical iOS or Android device (optional)

### Setup & Launch
```bash
cd mobile
npm install
npx expo start
```
The default API address works with an Android emulator or local iOS simulator. For a physical device, add `EXPO_PUBLIC_API_BASE_URL=https://your-server/api` to `mobile/.env` before starting Expo. Use an HTTPS address for a public server. Restart Expo after changing the address.
- Press `a` for Android Emulator.
- Press `i` for iOS Simulator.
- Press `w` for Web Preview.
- Or scan the terminal QR code with the **Expo Go** app on your phone!
