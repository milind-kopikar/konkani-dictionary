const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database connection (Railway and GCP compatible)
let connectionString = process.env.DATABASE_URL;

// If DATABASE_URL is not provided, construct it from PG* variables
if (!connectionString && process.env.PGHOST) {
  connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
}

const pool = new Pool({
  // Railway format (connectionString takes precedence)
  connectionString: connectionString,
  // Fallback to Railway PG* variables or GCP individual parameters
  host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: process.env.PGPORT || process.env.DB_PORT || 5432,
  database: process.env.PGDATABASE || process.env.DB_NAME || 'konkani_dictionary',
  user: process.env.PGUSER || process.env.DB_USER || 'konkani_dev',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
  // SSL for production (required by GCP Cloud SQL)
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  client_encoding: 'UTF8'
});

// Debug database connection
console.log('🔧 Database Configuration:');
console.log('  NODE_ENV:', NODE_ENV);
console.log('  CONNECTION_STRING:', connectionString ? 'Present' : 'Missing');
console.log('  PGHOST:', process.env.PGHOST || 'Missing');
console.log('  PGPORT:', process.env.PGPORT || 'Missing');
console.log('  PGDATABASE:', process.env.PGDATABASE || 'Missing');
console.log('  PGUSER:', process.env.PGUSER || 'Missing');
console.log('  PGPASSWORD:', process.env.PGPASSWORD ? 'Present' : 'Missing');

// CORS configuration for multiple origins (GitHub Pages + custom domains)
const corsOptions = {
  origin: [
    'http://localhost:3002',
    'https://milind-kopikar.github.io',
    'https://your-custom-domain.com', // Replace with actual domain
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (required for Cloud Run)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Amchigale Konkani Dictionary API', 
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Get all entries (paginated)
app.get('/api/dictionary', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT 
        entry_number,
        word_konkani_devanagari,
        word_konkani_english_alphabet,
        english_meaning,
        context_usage_sentence,
        devanagari_needs_correction,
        meaning_needs_correction
      FROM dictionary_entries 
      ORDER BY entry_number 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query('SELECT COUNT(*) FROM dictionary_entries');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      entries: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch dictionary entries' });
  }
});

// Search entries
app.get('/api/dictionary/search', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let query = '';
    let params = [];

    switch (type) {
      case 'english_word':
        query = `
          SELECT * FROM dictionary_entries 
          WHERE word_konkani_english_alphabet ILIKE $1
          ORDER BY entry_number
        `;
        params = [`%${q}%`];
        break;
        
      case 'devanagari':
        query = `
          SELECT * FROM dictionary_entries 
          WHERE word_konkani_devanagari ILIKE $1
          ORDER BY entry_number
        `;
        params = [`%${q}%`];
        break;
        
      case 'meaning':
        query = `
          SELECT * FROM dictionary_entries 
          WHERE english_meaning ILIKE $1
          ORDER BY entry_number
        `;
        params = [`%${q}%`];
        break;
        
      case 'context':
        query = `
          SELECT * FROM dictionary_entries 
          WHERE context_usage_sentence ILIKE $1
          ORDER BY entry_number
        `;
        params = [`%${q}%`];
        break;
        
      case 'fulltext':
        query = `
          SELECT * FROM dictionary_entries 
          WHERE search_vector @@ to_tsquery('english', $1)
          ORDER BY entry_number
        `;
        params = [q.replace(/\s+/g, ' & ')];
        break;
        
      default: // 'all'
        query = `
          SELECT * FROM dictionary_entries 
          WHERE word_konkani_english_alphabet ILIKE $1 
             OR word_konkani_devanagari ILIKE $1
             OR english_meaning ILIKE $1
             OR context_usage_sentence ILIKE $1
          ORDER BY entry_number
        `;
        params = [`%${q}%`];
    }

    const result = await pool.query(query, params);

    res.json({
      query: q,
      type,
      results: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching entries:', error);
    res.status(500).json({ error: 'Failed to search dictionary entries' });
  }
});

// Get single entry
app.get('/api/dictionary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM dictionary_entries 
      WHERE entry_number = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching entry:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Database stats
app.get('/api/stats', async (req, res) => {
  try {
    const queries = [
      { label: 'total_entries', query: 'SELECT COUNT(*) as count FROM dictionary_entries' },
      { label: 'with_devanagari', query: 'SELECT COUNT(*) as count FROM dictionary_entries WHERE word_konkani_devanagari IS NOT NULL' },
      { label: 'with_english_alphabet', query: 'SELECT COUNT(*) as count FROM dictionary_entries WHERE word_konkani_english_alphabet IS NOT NULL' },
      { label: 'needing_correction', query: 'SELECT COUNT(*) as count FROM dictionary_entries WHERE devanagari_needs_correction = true OR meaning_needs_correction = true' }
    ];

    const stats = {};
    for (const { label, query } of queries) {
      const result = await pool.query(query);
      stats[label] = parseInt(result.rows[0].count);
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// WhatsApp Bot Optimized Endpoints
// Quick search for bot responses (limited results)
app.get('/api/bot/search', async (req, res) => {
  try {
    const { q, limit = 3 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ 
        results: [], 
        message: "Please provide a search term with at least 2 characters." 
      });
    }
    
    const query = `
      SELECT 
        word_konkani_devanagari,
        word_konkani_english_alphabet,
        english_meaning,
        context_usage_sentence
      FROM dictionary_entries 
      WHERE 
        word_konkani_devanagari ILIKE $1 OR 
        word_konkani_english_alphabet ILIKE $1 OR 
        english_meaning ILIKE $1
      ORDER BY 
        CASE 
          WHEN word_konkani_devanagari ILIKE $2 THEN 1
          WHEN word_konkani_english_alphabet ILIKE $2 THEN 2
          WHEN english_meaning ILIKE $2 THEN 3
          ELSE 4
        END,
        LENGTH(COALESCE(english_meaning, ''))
      LIMIT $3
    `;
    
    const result = await pool.query(query, [`%${q}%`, `${q}%`, parseInt(limit)]);
    
    // Format for WhatsApp bot consumption
    const formattedResults = result.rows.map(row => ({
      konkani: row.word_konkani_devanagari,
      english_script: row.word_konkani_english_alphabet?.replace(/^\[|\]$/g, ''),
      meaning: row.english_meaning,
      example: row.context_usage_sentence,
      // Bot-friendly text format
      text: `${row.word_konkani_devanagari} → ${row.english_meaning || 'No meaning available'}`
    }));
    
    res.json({
      query: q,
      count: result.rows.length,
      results: formattedResults,
      bot_response: formattedResults.length > 0 
        ? `Found ${formattedResults.length} result(s) for "${q}":\n\n${formattedResults.map(r => r.text).join('\n')}`
        : `No results found for "${q}". Try a different spelling or search term.`
    });
    
  } catch (error) {
    console.error('Error in bot search:', error);
    res.status(500).json({ 
      error: 'Search failed',
      bot_response: 'Sorry, I encountered an error while searching. Please try again.'
    });
  }
});

// Direct word translation for bot
app.get('/api/bot/translate/:word', async (req, res) => {
  try {
    const { word } = req.params;
    
    const query = `
      SELECT 
        word_konkani_devanagari,
        word_konkani_english_alphabet,
        english_meaning,
        context_usage_sentence
      FROM dictionary_entries 
      WHERE 
        word_konkani_devanagari = $1 OR 
        word_konkani_english_alphabet = $1 OR
        english_meaning = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [word]);
    
    if (result.rows.length === 0) {
      return res.json({
        found: false,
        bot_response: `"${word}" not found in the dictionary. Try searching with partial spelling.`
      });
    }
    
    const entry = result.rows[0];
    res.json({
      found: true,
      konkani: entry.word_konkani_devanagari,
      english_script: entry.word_konkani_english_alphabet?.replace(/^\[|\]$/g, ''),
      meaning: entry.english_meaning,
      example: entry.context_usage_sentence,
      bot_response: `${entry.word_konkani_devanagari} → ${entry.english_meaning || 'No meaning available'}${entry.context_usage_sentence ? '\n\nExample: ' + entry.context_usage_sentence : ''}`
    });
    
  } catch (error) {
    console.error('Error in bot translation:', error);
    res.status(500).json({ 
      error: 'Translation failed',
      bot_response: 'Sorry, I encountered an error while translating. Please try again.'
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Konkani Dictionary Server running at http://localhost:${PORT}`);
  console.log(`📖 Frontend available at http://localhost:${PORT}`);
  console.log(`🔍 API endpoints:`);
  console.log('  GET /api/dictionary - List entries (paginated)');
  console.log('  GET /api/dictionary/search?q=word&type=all - Search entries');
  console.log('  GET /api/dictionary/:id - Get single entry');
  console.log('  GET /api/stats - Database statistics');
});

module.exports = app;