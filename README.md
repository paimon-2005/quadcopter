# 🛰️ Aegis Drone Surveillance Dashboard

A high-performance, real-time drone monitoring system built with React, Vite, and Tailwind CSS v4, integrated with Firebase Realtime Database.

## ✨ Features

- **🔥 Smoke & Sound Detection:** Real-time alert status ("DETECTED" vs "Clear") with red/green visual cues.
- **📡 Proximity Monitoring:** Horizontal progress bar showing distance in cm.
- **📷 Live ESP-CAM Feed:** Base64 image streaming with tactical overlay and REC indicator.
- **📈 Distance History:** Interactive AreaChart visualising proximity trends over time.
- **🔔 Notification System:** Animated toast alerts for critical sensor triggers.
- **🌙 Premium Dark Theme:** Glassmorphism design with sleek animations.

## 🚀 Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 + Framer Motion
- **Database:** Firebase Realtime Database
- **Charts:** Recharts
- **Icons:** Lucide React

## 🛠️ Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📡 Firebase Data Schema

The dashboard synchronizes with the following paths:
- `/drone/distance` → float (cm)
- `/drone/smoke` → boolean
- `/drone/sound` → boolean
- `/drone/image` → base64 string

## 🎨 Styling

The application uses custom CSS variables for a premium dark mode experience:
- **Glassmorphism:** `.glass-card` for transparent, blurred containers.
- **Animations:** `framer-motion` for fluid notification entry/exit.
- **Tailwind v4:** Native CSS-first configuration and @import pipeline.

---
*Built with Antigravity 🛡️*
