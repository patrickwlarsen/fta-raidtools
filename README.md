# FTA Raid Tools

Desktop application for managing raids, loot, and attendance for the WoW TBC Anniversary guild **From the Ashes**.

## Features

- **Raid Management** - Configure raid-specific settings including completion awards, item win deductions, deduction caps, and absence penalties
- **Loot History** - Import loot data from CSV with per-raid deduction tracking and maximum deduction caps
- **Attendance Tracking** - Record attendance from Raid Helper events, track sign-up compliance, and apply configurable deductions for absences or missing sign-ups
- **Google Sheets Integration** - Load and save raid settings, loot history, and attendance data to Google Sheets
- **Auto-Updates** - Automatic update notifications via GitHub Releases

## Getting Started

### Prerequisites

- Node.js
- npm

### Development

```bash
npm install
npm run dev
```

### Watch Mode

```bash
npm run dev:watch
```

### Build

```bash
npm run build
npm run dist
```

## Tech Stack

- Electron
- TypeScript
- ag-grid-community
- electron-updater
- Google Auth Library
