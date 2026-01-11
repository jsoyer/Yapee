# Changelog - Yape PyLoad 0.5.0+ Compatible

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.4] - 2026-01-11

### Fixed

- **Complete resolution of CSRF token error**: The "CSRF token is invalid" error that prevented communication with PyLoad 0.5.0+ has been completely fixed
- **API endpoint compatibility**: All endpoints updated to match PyLoad 0.5.0+ naming convention (camelCase → snake_case)
- **Authentication system**: Implemented HTTP Basic Authentication on all API requests as required by PyLoad 0.5.0+
- **HTTP methods**: Corrected HTTP methods for all endpoints (POST → GET for read operations)
- **Data format**: Migrated from URL-encoded to JSON format for API requests
- **Error handling**: Improved detection and handling of authentication errors

### Added

- **Credential storage**: Automatic storage and reuse of login credentials via chrome.storage.sync
- **HTTP Basic Auth support**: Added Authorization header to all API calls
- **Helper functions**: 
  - `setCredentials()` - Securely store user credentials
  - `getAuthHeader()` - Generate HTTP Basic Auth header
- **Enhanced error detection**: CSRF and unauthorized errors now properly trigger login prompt
- **Comprehensive documentation**:
  - `RAPPORT_CORRECTIONS.md` - Complete technical documentation (French)
  - `INSTALLATION.md` - Step-by-step installation guide
  - `README.md` - Professional project overview

### Changed

- **Authentication method**: Migrated from session cookies to HTTP Basic Authentication
- **API endpoints**: Updated all endpoint names to match new PyLoad API:
  - `/api/login` → `/api/check_auth`
  - `/api/statusServer` → `/api/status_server`
  - `/api/statusDownloads` → `/api/status_downloads`
  - `/api/getQueueData` → `/api/get_queue_data`
  - `/api/addPackage` → `/api/add_package`
  - `/api/checkURLs` → `/api/check_urls`
  - `/api/getConfigValue` → `/api/get_config_value`
  - `/api/setConfigValue` → `/api/set_config_value`
- **Request format**: All POST requests now use JSON body instead of URL-encoded parameters
- **Extension name**: Updated to "Yape (PyLoad 0.5.0+ HTTP Basic Auth)" for clarity
- **Version**: Bumped to 1.1.4

### Technical Details

#### Modified Files

**js/pyload-api.js**
- Updated `login()` function to use `/api/check_auth` with GET method
- Added HTTP Basic Auth header to all API functions
- Converted all camelCase endpoints to snake_case
- Changed POST methods to GET for read operations
- Migrated data format from URL-encoded to JSON for write operations

**js/storage.js**
- Added `username` and `password` variables
- Implemented `setCredentials()` function for secure credential storage
- Implemented `getAuthHeader()` function to generate Basic Auth headers
- Updated `pullStoredData()` to retrieve stored credentials

**options.js**
- Added CSRF error filtering to prevent confusing error messages
- Improved login status detection

**manifest.json**
- Updated version to 1.1.4
- Updated extension name to reflect PyLoad 0.5.0+ compatibility
- Updated description

---

## [1.1.2] - Original Version

### Features (Original Yape by RemiRigal)

- One-click download functionality
- Monitor current downloads with progress and ETA
- Monitor global bandwidth usage
- One-click speed limiter
- Context menu integration for downloading links
- Simple and clean user interface

### Known Issues (Fixed in 1.1.4)

- ❌ CSRF token error with PyLoad 0.5.0+
- ❌ Incompatible with new PyLoad API
- ❌ Authentication failures
- ❌ Method not allowed errors

---

## Compatibility

### Version 1.1.4

- ✅ **PyLoad**: 0.5.0 and higher
- ✅ **Chrome**: Latest version (Manifest V3)
- ✅ **Edge**: Latest version
- ✅ **Brave**: Latest version
- ✅ **Firefox**: Compatible with minor adjustments

### Version 1.1.2 (Original)

- ✅ **PyLoad**: < 0.5.0
- ❌ **PyLoad**: 0.5.0+ (not compatible)

---

## Migration Guide

### Upgrading from 1.1.2 to 1.1.4

If you're upgrading from the original Yape (1.1.2):

1. **Uninstall the old version**:
   - Go to `chrome://extensions/`
   - Remove the old Yape extension

2. **Install version 1.1.4**:
   - Follow instructions in [INSTALLATION.md](INSTALLATION.md)

3. **Reconfigure**:
   - Enter your PyLoad server details
   - Login with your credentials (they will be stored for future use)

4. **Verify**:
   - Check that you see "✓ You are logged in" in green
   - No CSRF error should appear

---

## Credits

### Original Project
- **Author**: Rémi Rigal ([@RemiRigal](https://github.com/RemiRigal))
- **Repository**: [RemiRigal/Yape](https://github.com/RemiRigal/Yape)
- **License**: MIT

### PyLoad 0.5.0+ Compatibility Fork
- **Maintainer**: [@jsoyer](https://github.com/jsoyer)
- **Repository**: [jsoyer/Yape](https://github.com/jsoyer/Yape)
- **Branch**: `pyload-0.5-compatible`

---

## Links

- [Installation Guide](INSTALLATION.md)
- [Technical Documentation](RAPPORT_CORRECTIONS.md) (French)
- [README](README.md)
- [GitHub Repository](https://github.com/jsoyer/Yape)
- [PyLoad Project](https://github.com/pyload/pyload)

---

**Note**: This changelog covers changes made specifically for PyLoad 0.5.0+ compatibility. For the complete history of the original project, see [RemiRigal/Yape](https://github.com/RemiRigal/Yape).
