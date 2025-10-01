# Database Management Scripts

This directory contains utility scripts for managing the Konkani dictionary database.

## 📁 Scripts Overview

### Import & Migration
- **`enhanced-import.js`** - Robust CSV import with error handling
- **`retry-import.js`** - Retry failed imports after schema fixes
- **`database/export.js`** - Export database for deployment
- **`database/migrate-to-railway.js`** - Auto-generated Railway migration

### Database Maintenance
- **`fix-schema.js`** - Schema modifications and fixes
- **`final-stats.js`** - Comprehensive database statistics
- **`import-spreadsheet.js`** - Original import script (legacy)

### Data Files
- **`konkani_dictionary_csv.csv`** - Source data (4,384 entries)
- **`database/konkani_dictionary_export.sql`** - Complete database dump
- **`database/konkani_dictionary_export.json`** - JSON export for backup

## 🚀 Usage Commands

### Import Data
```bash
# Enhanced import (recommended)
node scripts/enhanced-import.js konkani_dictionary_csv.csv

# Retry failed entries
node scripts/retry-import.js

# Original import (legacy)
node import-spreadsheet.js
```

### Database Operations
```bash
# Export for deployment
node database/export.js

# Get statistics
node scripts/final-stats.js

# Fix schema issues
node scripts/fix-schema.js
```

### Deployment
```bash
# Deploy to Railway
npm run deploy

# Migrate to Railway database
node database/migrate-to-railway.js
```

## 🔧 When to Use Each Script

### During Development
- **`enhanced-import.js`** - When adding new CSV data or rebuilding database
- **`final-stats.js`** - To check database health and content statistics
- **`fix-schema.js`** - When database schema needs modifications

### For Deployment
- **`database/export.js`** - Before deploying to create migration files
- **`database/migrate-to-railway.js`** - When setting up Railway database

### For Backup/Recovery
- **`database/export.js`** - Regular backups of complete database
- **`enhanced-import.js`** - Restore from CSV if needed

## ⚠️ Important Notes

### Keep These Files Because:
1. **Active Development** - You're still adding features and testing
2. **Database Rebuilds** - May need to recreate database with schema changes
3. **Data Updates** - CSV file might be updated with new entries
4. **Deployment** - Different environments may need fresh imports
5. **Backup Strategy** - Essential for disaster recovery
6. **GCP Migration** - Will need these when moving to Google Cloud

### Don't Delete:
- ❌ CSV files (source data)
- ❌ Import scripts (database recreation)
- ❌ Export scripts (deployment)
- ❌ Migration scripts (platform changes)

### Can Delete Later:
- ✅ Error logs (after issues resolved)
- ✅ Temporary test files
- ✅ Old backup files (after confirmed working)

## 📋 Maintenance Checklist

### Weekly
- [ ] Run `final-stats.js` to monitor database health
- [ ] Check for any import errors in logs

### Before Major Changes
- [ ] Run `database/export.js` for backup
- [ ] Test import scripts with sample data

### Before Deployment
- [ ] Export complete database
- [ ] Verify all scripts work with production environment
- [ ] Update environment variables in `.env.example`