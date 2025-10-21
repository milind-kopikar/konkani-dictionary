# 🕉️ Amchigale Konkani Dictionary

Complete digital dictionary for the Konkani language with 4,000+ entries, designed for modern web and WhatsApp bot integration with crowdsourcing capabilities.

## 📋 Current Status (October 2025)

### ✅ Completed Features
- **Multi-cloud database support** (Railway, Google Cloud SQL, Azure Database, Local PostgreSQL)
- **Crowdsourcing system** with expert review workflow
- **JWT-based expert authentication** for admin review panel
- **Responsive web interface** with search and contribution features
- **WhatsApp bot optimized API** endpoints
- **Comprehensive deployment configurations** for all major cloud providers
- **Expert review bug fix** - Admin edits now properly save to database
- **Navigation improvements** - Back to homepage buttons on all pages

### 🔄 Recent Changes (Latest Session)
- **Fixed critical expert review bug** where admin edits were ignored during approval
- **Added debug logging** throughout the expert review workflow
- **Enhanced navigation** with "🏠 Back to Dictionary" buttons on all pages
- **Improved error handling** in suggestion submission and review processes

### 🚧 Next Steps
- Remove debug statements from production code
- Test multi-cloud configurations with different providers
- Implement user contribution statistics dashboard
- Add bulk import/export functionality for experts

## 🌟 Features

- **4,381 Konkani dictionary entries** with Devanagari script and English meanings
- **Multi-search capabilities** - Search by Devanagari, English alphabet, or meaning
- **Crowdsourcing platform** - Community can suggest corrections and additions
- **Expert review system** - Authenticated experts can approve/reject suggestions
- **WhatsApp bot ready API** - Optimized endpoints for conversational AI
- **Unicode support** - Proper rendering of Konkani diacritical marks
- **Responsive web interface** - Works on desktop and mobile
- **Multi-cloud deployment** - Supports Railway, GCP, Azure, and local PostgreSQL

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Express API   │    │   PostgreSQL    │
│   (GitHub Pages)│◄──►│   (Railway/GCP) │◄──►│   Database       │
│                 │    │                 │    │                 │
│ • Search UI     │    │ • REST API      │    │ • Dictionary    │
│ • Contribution  │    │ • JWT Auth      │    │   Entries       │
│ • Admin Panel   │    │ • Bot Endpoints │    │ • Suggestions    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### File Structure

```
konkani_dictionary/
├── server.js                 # Main Express server with multi-cloud DB support
├── package.json             # Dependencies and scripts
├── public/                  # Static web files
│   ├── index.html          # Main dictionary search interface
│   ├── admin-review.html   # Expert review panel
│   ├── suggest-corrections.html  # Community contribution form
│   └── test.html           # API testing page
├── database/               # Database schemas and migration scripts
│   ├── railway_schema.sql  # Main dictionary table schema
│   ├── crowdsourcing_schema.sql  # Community features tables
│   └── migrate-to-railway.js  # Migration utilities
├── routes/                 # API route handlers
├── scripts/                # Utility scripts
├── DEPLOYMENT_CONFIG.md    # Comprehensive deployment guide
└── .env.*                  # Environment configuration templates
```

### Database Schema

#### Core Dictionary Table
```sql
CREATE TABLE dictionary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number INTEGER UNIQUE,
  word_konkani_devanagari TEXT,           -- Devanagari script
  word_konkani_english_alphabet TEXT,     -- Romanized Konkani
  english_meaning TEXT,                   -- English translation
  context_usage_sentence TEXT,            -- Example sentence
  devanagari_needs_correction BOOLEAN DEFAULT FALSE,
  meaning_needs_correction BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  search_vector TSVECTOR                  -- Full-text search index
);
```

#### Crowdsourcing Tables
```sql
-- Community contributors and experts
CREATE TABLE contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(100),
  is_expert BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  contributions_count INTEGER DEFAULT 0,
  approved_contributions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  password_hash VARCHAR(255)
);

-- User-submitted suggestions
CREATE TABLE dictionary_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_entry_id UUID REFERENCES dictionary_entries(id),
  contributor_id UUID REFERENCES contributors(id),
  suggestion_type VARCHAR(20), -- 'correction', 'addition', 'deletion'
  -- Original values (for corrections)
  original_word_konkani_devanagari TEXT,
  original_word_konkani_english_alphabet TEXT,
  original_english_meaning TEXT,
  original_context_usage_sentence TEXT,
  -- Suggested values
  suggested_word_konkani_devanagari TEXT,
  suggested_word_konkani_english_alphabet TEXT,
  suggested_english_meaning TEXT,
  suggested_context_usage_sentence TEXT,
  -- Review workflow
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES contributors(id),
  reviewed_at TIMESTAMP,
  reviewer_notes TEXT,
  contributor_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for all changes
CREATE TABLE dictionary_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES dictionary_entries(id),
  suggestion_id UUID REFERENCES dictionary_suggestions(id),
  change_type VARCHAR(20), -- 'correction', 'addition'
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES contributors(id),
  approved_by UUID REFERENCES contributors(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Live Deployment

- **Production API:** https://konkani-dictionary-production.up.railway.app
- **Web Interface:** https://milind-kopikar.github.io/konkani-dictionary/
- **Admin Panel:** https://milind-kopikar.github.io/konkani-dictionary/admin-review.html

## 📱 API Documentation

### Public Endpoints

#### Dictionary Search & Retrieval
```
GET /api/dictionary/search?q=word&type=all
GET /api/dictionary?limit=20&page=1
GET /api/dictionary/:id
GET /api/stats
```

#### Community Contributions
```
POST /api/suggestions              # Submit correction/addition
GET  /api/suggestions              # List public suggestions (future)
```

#### Expert Review System (JWT Protected)
```
POST /api/admin/login              # Expert authentication
GET  /api/admin/validate           # Token validation
GET  /api/admin/stats              # Dashboard statistics
GET  /api/admin/suggestions        # List suggestions for review
GET  /api/admin/suggestions/:id    # Get suggestion details
POST /api/admin/suggestions/:id/review  # Approve/reject with edits
```

#### WhatsApp Bot Endpoints
```
GET /api/bot/search?q=word&limit=3
GET /api/bot/translate/:word
POST /api/agent/search             # API key authenticated
```

#### System Management
```
GET /api/health                   # Health check
GET /api/debug/db                 # Database connection info
POST /api/migrate                 # Initial data import
POST /api/migrate-crowdsourcing   # Create community tables
```

### Authentication

**Expert Login:**
```bash
curl -X POST https://api.example.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"expert@konkani.org","password":"admin123"}'
```

**Protected Endpoints:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.example.com/api/admin/suggestions
```

## 🔧 Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Git

### Quick Start
```bash
# Clone and setup
git clone https://github.com/milind-kopikar/konkani-dictionary.git
cd konkani-dictionary
npm install

# Configure database
cp .env.local.example .env
# Edit .env with your PostgreSQL credentials

# Import dictionary data
npm run migrate:railway

# Start development server
npm run dev
# Server runs at http://localhost:3002
```

### Environment Configuration

Create `.env` file:
```bash
# Database (choose one configuration method)
DATABASE_URL=postgresql://user:pass@localhost:5432/konkani_dictionary
# OR individual variables:
PGHOST=localhost
PGPORT=5432
PGDATABASE=konkani_dictionary
PGUSER=your_username
PGPASSWORD=your_password

# Server
PORT=3002
NODE_ENV=development

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Optional: API Keys for agent endpoints
AGENT_API_KEYS=key1,key2,key3
```

## 🚀 Deployment

### Railway (Current Production)
1. Connect GitHub repository to Railway
2. Add PostgreSQL service
3. Set environment variables
4. Deploy automatically

### Google Cloud Platform
```bash
# Build and deploy to Cloud Run
gcloud run deploy konkani-dictionary \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=$DATABASE_URL
```

### Azure
```bash
# Deploy to Azure Container Instances
az container create \
  --resource-group myResourceGroup \
  --name konkani-dictionary \
  --image milindkopikar/konkani-dictionary:latest \
  --dns-name-label konkani-dictionary \
  --ports 3002 \
  --environment-variables DATABASE_URL=$DATABASE_URL
```

## 🧪 Testing

### API Testing
```bash
# Health check
curl http://localhost:3002/health

# Search test
curl "http://localhost:3002/api/dictionary/search?q=hello&type=all"

# Database debug
curl http://localhost:3002/api/debug/db
```

### Manual Testing Pages
- `http://localhost:3002/test.html` - API connection test
- `http://localhost:3002/admin-review.html` - Expert review interface
- `http://localhost:3002/suggest-corrections.html` - Contribution form

## 📊 Database Management

### Migration Commands
```bash
# Initial dictionary import
npm run migrate:railway

# Create crowdsourcing tables
curl -X POST http://localhost:3002/api/migrate-crowdsourcing

# Export current data
npm run export
```

### Backup & Restore
```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## 🤝 Contributing

### For Community Contributors
1. Visit the web interface
2. Use "Suggest Changes" to submit corrections
3. Provide detailed notes for reviewers

### For Expert Reviewers
1. Log in to admin panel with expert credentials
2. Review pending suggestions
3. Edit suggestions before approval if needed
4. Add review notes for transparency

### For Developers
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📈 Statistics

- **Total entries:** 4,381
- **With Devanagari:** 3,646 (83.2%)
- **With English meanings:** 3,714 (84.8%)
- **Community suggestions:** Dynamic (growing)
- **Expert reviews:** Active review system
- **Languages:** Konkani ↔ English
- **Script support:** Devanagari, Latin

## 🔧 Troubleshooting

### Common Issues

**Database Connection Failed:**
- Check PostgreSQL is running
- Verify connection string in `.env`
- For Railway: ensure SSL settings are correct

**Expert Login Not Working:**
- Ensure crowdsourcing tables are migrated
- Check JWT_SECRET is set
- Verify expert credentials in database

**Search Not Working:**
- Check database has search indexes
- Verify search_vector column is populated
- Test with simple queries first

**CORS Errors:**
- Check API_BASE_URL configuration in frontend
- Ensure CORS origins include your domain

## 📜 License

MIT License - Free for language preservation and educational projects.

## 🙏 Acknowledgments

- Konkani language community
- Original dictionary contributors
- Google Fonts for Devanagari support
- Railway for hosting infrastructure

## 📞 Contact

**Milind Kopikar**
- GitHub: [@milind-kopikar](https://github.com/milind-kopikar)
- Project: [Konkani Dictionary](https://github.com/milind-kopikar/konkani-dictionary)

---

*Preserving the Konkani language through community-driven technology* 🕉️