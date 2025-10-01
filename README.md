# 🕉️ Amchigale Konkani Dictionary

Complete digital dictionary for the Konkani language with 4,000+ entries, designed for modern web and WhatsApp bot integration.

## 🌟 Features

- **4,381 Konkani dictionary entries** with Devanagari script and English meanings
- **Multi-search capabilities** - Search by Devanagari, English alphabet, or meaning
- **WhatsApp bot ready API** - Optimized endpoints for conversational AI
- **Unicode support** - Proper rendering of Konkani diacritical marks
- **Responsive web interface** - Works on desktop and mobile
- **Google Cloud migration ready** - Architecture designed for scalability

## 🚀 Live Demo

- **Web Interface:** [Coming Soon - Railway Deployment]
- **API Endpoints:** [Coming Soon - Railway API]

## 📱 API Documentation

### Public Endpoints

#### Dictionary Search
```
GET /api/dictionary/search?q=word&type=all
```

#### Get All Entries (Paginated)
```
GET /api/dictionary?limit=20&offset=0
```

#### Get Single Entry
```
GET /api/dictionary/:id
```

#### Database Statistics
```
GET /api/stats
```

### WhatsApp Bot Endpoints

#### Quick Search (Bot Optimized)
```
GET /api/bot/search?q=word&limit=3
```

#### Direct Translation
```
GET /api/bot/translate/word
```

## 🏗️ Architecture

### Current (Railway)
```
Frontend (GitHub Pages) → Railway API → PostgreSQL
```

### Future (Google Cloud + WhatsApp)
```
WhatsApp Bot → Cloud Run → Cloud SQL → Frontend
```

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Git

### Setup
```bash
# Clone repository
git clone https://github.com/milind-kopikar/konkani-dictionary.git
cd konkani-dictionary

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Import dictionary data
npm run import

# Start development server
npm run dev
```

## 📊 Database Schema

```sql
CREATE TABLE dictionary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number INTEGER UNIQUE,
  word_konkani_devanagari TEXT,
  word_konkani_english_alphabet TEXT,
  english_meaning TEXT,
  context_usage_sentence TEXT,
  devanagari_needs_correction BOOLEAN DEFAULT FALSE,
  meaning_needs_correction BOOLEAN DEFAULT FALSE,
  -- ... additional fields for user corrections
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Railway Deployment

### Quick Deploy
1. Fork this repository
2. Connect to Railway
3. Add PostgreSQL service
4. Deploy automatically

### Manual Deploy
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create project
railway project

# Add PostgreSQL
railway service

# Deploy
railway up
```

## 🌐 Google Cloud Migration (Future)

Ready for migration to:
- **Cloud Run** (containerized API)
- **Cloud SQL** (managed PostgreSQL)
- **Cloud Storage** (static assets)
- **Load Balancer** (custom domain)

## 🤖 WhatsApp Integration (Planned)

Features in development:
- Natural language search
- Conversational dictionary lookup
- Voice message support
- User contribution system

## 📈 Statistics

- **Total entries:** 4,381
- **With Devanagari:** 3,646 (83.2%)
- **With English meanings:** 3,714 (84.8%)
- **Languages:** Konkani ↔ English
- **Script support:** Devanagari, Latin

## 🤝 Contributing

We welcome contributions to improve the dictionary:

1. **Corrections** - Fix spelling or meaning errors
2. **New entries** - Add missing Konkani words
3. **Context examples** - Provide usage sentences
4. **Technical improvements** - Enhance search or UI

## 📜 License

MIT License - Feel free to use this for language preservation projects.

## 🙏 Acknowledgments

- Konkani language community
- Contributors to the original dictionary data
- Google Fonts for Devanagari typography support

## 📞 Contact

**Milind Kopikar**
- GitHub: [@milind-kopikar](https://github.com/milind-kopikar)
- Website: [milind-kopikar.github.io](https://milind-kopikar.github.io)

---

*Preserving the Konkani language through technology* 🕉️