# Changelog

## v1.4.0

### New Features
- **Raid Settings Management** - New raid settings section on the Raid page with full CRUD support (add, delete, load/save to Google Sheets) powered by ag-grid
- **Raid Selection on Import** - Mandatory raid selection dropdown added to CSV import (Loot History) and attendance event entry dialogs
- **Did Not Sign Up Tracking** - New attendance section showing roster members who didn't sign up, with configurable per-raid deductions applied to roll modifiers

### Changes
- Item win deductions and max deduction caps are now per-raid instead of global settings
- Award for raid completion and absence deductions are now raid-specific
- Updated Raid Helper API endpoint from raid-helper.dev to raid-helper.xyz (v4), with backwards compatibility for both domains
- Google Sheets integration now clears existing data before writing to prevent stale rows
- New raid settings sheet support with headers: ID, name, award-for-completion, item-win-deduction, items-deduction-max, absence-unexcused, did-not-sign-up
- Modal dialogs now include a close button header and improved focus management
- Repository moved to github.com/emsw0rth/fta-raidtools

### Bug Fixes
- Fixed item win deduction logic to properly cap total deductions per player during import

## v1.3.1

- Patch release

## v1.3.0

- Feature release

## v1.2.0

- Feature release

## v1.1.0

- Feature release

## v1.0.0

- Initial release of FTA Raid Tools
