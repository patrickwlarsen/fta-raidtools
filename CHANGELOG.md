# Changelog

## v1.1.0

### Added
- **Auto-update**: The app now checks GitHub for new releases on startup and prompts to download and install updates
- **Attendance page**: Load Raid Helper events, review sign-ups, and award roll modifier bonuses
  - Award column with configurable point values (default 0.2)
  - "Award to" column maps sign-ups to roster names
  - "Confirm & Award" applies bonuses to roster roll modifiers and saves to the sheet
  - Attendance history stored in the `attendance` sheet tab with date, event name, link, and full event data
  - Previous events list with clickable Raid Helper links
- **Data preloading**: All sheet tabs (loot history, roster, attendance) are fetched in the background at startup
- **Dev watch mode**: `npm run dev:watch` for auto-reload during development using concurrently and electronmon

### Changed
- Loot history and roster pages now subscribe to store updates instead of fetching on page creation
- Roster columns updated to include Raid-Helper name, Main, and Roll Modifier

## v1.0.0

- Initial release
- Loot history management with Google Sheets integration
- Guild roster management
- CSV import with duplicate detection
- Wowhead item tooltips
- Settings page for Google Sheet and service account configuration
