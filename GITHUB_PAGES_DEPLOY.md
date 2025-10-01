# GitHub Pages + Railway Deployment Guide

## 🎯 Deployment Overview

### Architecture
```
milind-kopikar.github.io (Frontend)
    ↓ API calls
Railway (Backend + Database)
    ↓ Data
PostgreSQL (4,381 entries)
```

## 📋 Step-by-Step Deployment

### Phase 1: Railway Backend Deployment

#### 1. Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with your GitHub account
3. Verify email

#### 2. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Authorize Railway to access your repositories
4. Select your `konkani-dictionary` repository

#### 3. Configure Services
```bash
# Railway will auto-detect your Node.js app
# Add PostgreSQL database:
# 1. Click "New Service" in project
# 2. Select "Database" → "PostgreSQL"
# 3. Railway provisions automatically
```

#### 4. Set Environment Variables
In Railway dashboard, go to your service → Variables:
```
NODE_ENV=production
FRONTEND_URL=https://milind-kopikar.github.io
ALLOWED_ORIGINS=https://milind-kopikar.github.io
```

#### 5. Deploy Database
```bash
# Railway provides DATABASE_URL automatically
# After deployment, run migration:
railway run npm run migrate:railway
```

#### 6. Get Railway URL
- Railway will provide a URL like: `https://konkani-dictionary-production.up.railway.app`
- Test endpoints:
  - `/health` - Health check
  - `/api/stats` - Database statistics
  - `/api/dictionary?limit=5` - Sample entries

### Phase 2: GitHub Pages Frontend

#### 1. Create Repository Structure
```
milind-kopikar.github.io/
├── index.html (your homepage)
├── konkani-dictionary/
│   └── index.html (dictionary app)
└── assets/ (your existing files)
```

#### 2. Add Dictionary to Homepage
Add this card to your main `index.html`:
```html
<!-- Copy content from github-pages/homepage-card.html -->
```

#### 3. Create Dictionary Page
```bash
# In your milind-kopikar.github.io repository:
mkdir konkani-dictionary
cp github-pages/index.html konkani-dictionary/index.html
```

#### 4. Update API URL
In `konkani-dictionary/index.html`, update:
```javascript
const API_BASE = 'https://your-railway-url.railway.app/api';
```

#### 5. Commit and Deploy
```bash
git add .
git commit -m "Add Konkani Dictionary app"
git push origin main
```

### Phase 3: Testing and Verification

#### Test Railway Backend
```bash
# Test health
curl https://your-railway-url.railway.app/health

# Test stats
curl https://your-railway-url.railway.app/api/stats

# Test search
curl "https://your-railway-url.railway.app/api/dictionary/search?q=house"
```

#### Test GitHub Pages
1. Visit: `https://milind-kopikar.github.io`
2. Click on Konkani Dictionary card
3. Should open: `https://milind-kopikar.github.io/konkani-dictionary/`
4. Test search functionality

## 🔧 Configuration Files Needed

### 1. Update CORS in server.js
```javascript
const corsOptions = {
  origin: [
    'https://milind-kopikar.github.io',
    'https://your-railway-url.railway.app'
  ]
};
```

### 2. Update Frontend API URL
```javascript
// In github-pages/index.html
const API_BASE = 'https://your-railway-url.railway.app/api';
```

## 📊 Expected Results

### Railway Deployment
- ✅ Backend API running on Railway
- ✅ PostgreSQL with 4,381 entries
- ✅ All endpoints accessible via HTTPS
- ✅ Automatic scaling and SSL

### GitHub Pages Integration
- ✅ Dictionary featured on your homepage
- ✅ Standalone dictionary app at `/konkani-dictionary/`
- ✅ Professional presentation
- ✅ Mobile-responsive design

### User Experience
- ✅ Click card on homepage → Opens dictionary
- ✅ Search 4,000+ Konkani words
- ✅ View Devanagari script properly
- ✅ Fast API responses from Railway

## 🚀 Next Steps After Deployment

1. **Test all functionality**
2. **Share with Konkani community**
3. **Monitor usage analytics**
4. **Plan user contribution features**
5. **Prepare for WhatsApp bot integration**

## 📝 Deployment Checklist

### Railway
- [ ] Account created
- [ ] Repository connected
- [ ] PostgreSQL service added
- [ ] Environment variables set
- [ ] Database migrated
- [ ] API endpoints tested

### GitHub Pages
- [ ] Dictionary folder created
- [ ] Frontend files uploaded
- [ ] API URL updated
- [ ] Homepage card added
- [ ] CORS configured
- [ ] Full app tested

### Integration
- [ ] Cross-origin requests working
- [ ] Search functionality working
- [ ] Statistics loading
- [ ] Mobile responsiveness verified
- [ ] Social sharing tested