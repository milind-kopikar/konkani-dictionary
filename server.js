const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
  // SSL configuration for Railway (more permissive)
  ssl: NODE_ENV === 'production' ? { 
    rejectUnauthorized: false,
    require: true 
  } : false,
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
        id,
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
    console.log('Fetching entry with ID:', id);
    
    // Check if the id is a UUID (for id field) or a number (for entry_number field)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    console.log('Is UUID:', isUUID);
    
    let query;
    if (isUUID) {
      query = `SELECT * FROM dictionary_entries WHERE id = $1`;
    } else {
      query = `SELECT * FROM dictionary_entries WHERE entry_number = $1`;
    }
    
    console.log('Executing query:', query, 'with param:', id);
    const result = await pool.query(query, [id]);
    console.log('Query result rows count:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('No entry found for ID:', id);
      return res.status(404).json({ error: 'Entry not found' });
    }

    console.log('Found entry:', result.rows[0].entry_number);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching entry:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch entry', details: error.message });
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

// Migration endpoint (for Railway deployment)
app.post('/api/migrate', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    console.log('🚀 Starting database migration...');
    
    // Check if table already exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'dictionary_entries'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      const countResult = await pool.query('SELECT COUNT(*) FROM dictionary_entries');
      return res.json({ 
        message: 'Database already migrated', 
        entries: parseInt(countResult.rows[0].count) 
      });
    }
    
    // Create schema
    console.log('📖 Creating database schema...');
    const schemaPath = path.join(__dirname, 'database', 'railway_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    
    // Import data from JSON
    console.log('📊 Importing data from JSON...');
    const jsonPath = path.join(__dirname, 'database', 'konkani_dictionary_export.json');
    const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    console.log(`� Importing ${entries.length} entries...`);
    
    // Import in batches
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      for (const entry of batch) {
        await pool.query(`
          INSERT INTO dictionary_entries (
            entry_number, word_konkani_devanagari, word_konkani_english_alphabet,
            english_meaning, context_usage_sentence, devanagari_needs_correction,
            meaning_needs_correction
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (entry_number) DO NOTHING
        `, [
          entry.entry_number,
          entry.word_konkani_devanagari,
          entry.word_konkani_english_alphabet,
          entry.english_meaning,
          entry.context_usage_sentence,
          entry.devanagari_needs_correction || false,
          entry.meaning_needs_correction || false
        ]);
        imported++;
      }
      
      console.log(`📊 Imported ${Math.min(i + batchSize, entries.length)} / ${entries.length} entries`);
    }
    
    // Verify migration
    const result = await pool.query('SELECT COUNT(*) FROM dictionary_entries');
    const count = parseInt(result.rows[0].count);
    
    console.log(`✅ Migration completed: ${count} entries imported`);
    
    res.json({ 
      message: 'Migration completed successfully', 
      entries: count,
      processed: imported
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed', 
      details: error.message 
    });
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

// ==========================================
// CROWDSOURCING & EXPERT REVIEW SYSTEM
// ==========================================

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware to verify expert token
const verifyExpert = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Verify user is still an active expert
        const result = await pool.query(
            'SELECT * FROM contributors WHERE id = $1 AND is_expert = true AND is_active = true',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
};

// 1. Submit a new suggestion (public route)
app.post('/api/suggestions', async (req, res) => {
    try {
        const {
            suggestionType,
            originalEntryId,
            suggestedDevanagari,
            suggestedEnglishAlphabet,
            suggestedMeaning,
            suggestedContext,
            contributorNotes,
            contributorName,
            contributorEmail
        } = req.body;

        // Validation
        if (!contributorName || !contributorEmail) {
            return res.status(400).json({ message: 'Contributor name and email are required' });
        }

        if (!suggestedDevanagari && !suggestedMeaning) {
            return res.status(400).json({ message: 'At least Devanagari word or English meaning is required' });
        }

        // Create or get contributor
        let contributor;
        const existingContributor = await pool.query(
            'SELECT * FROM contributors WHERE email = $1',
            [contributorEmail]
        );

        if (existingContributor.rows.length > 0) {
            contributor = existingContributor.rows[0];
            // Update contribution count
            await pool.query(
                'UPDATE contributors SET contributions_count = contributions_count + 1 WHERE id = $1',
                [contributor.id]
            );
        } else {
            const newContributor = await pool.query(
                'INSERT INTO contributors (email, name, contributions_count) VALUES ($1, $2, 1) RETURNING *',
                [contributorEmail, contributorName]
            );
            contributor = newContributor.rows[0];
        }

        // Get original entry data if it's a correction
        let originalData = {};
        if (suggestionType === 'correction' && originalEntryId) {
            const originalEntry = await pool.query(
                'SELECT * FROM dictionary_entries WHERE id = $1',
                [originalEntryId]
            );
            
            if (originalEntry.rows.length > 0) {
                const original = originalEntry.rows[0];
                originalData = {
                    original_word_konkani_devanagari: original.word_konkani_devanagari,
                    original_word_konkani_english_alphabet: original.word_konkani_english_alphabet,
                    original_english_meaning: original.english_meaning,
                    original_context_usage_sentence: original.context_usage_sentence
                };
            }
        }

        // Insert suggestion
        const suggestion = await pool.query(`
            INSERT INTO dictionary_suggestions (
                original_entry_id,
                contributor_id,
                suggestion_type,
                original_word_konkani_devanagari,
                original_word_konkani_english_alphabet,
                original_english_meaning,
                original_context_usage_sentence,
                suggested_word_konkani_devanagari,
                suggested_word_konkani_english_alphabet,
                suggested_english_meaning,
                suggested_context_usage_sentence,
                contributor_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            originalEntryId || null,
            contributor.id,
            suggestionType,
            originalData.original_word_konkani_devanagari || null,
            originalData.original_word_konkani_english_alphabet || null,
            originalData.original_english_meaning || null,
            originalData.original_context_usage_sentence || null,
            suggestedDevanagari || null,
            suggestedEnglishAlphabet || null,
            suggestedMeaning || null,
            suggestedContext || null,
            contributorNotes || null
        ]);

        res.json({
            message: 'Suggestion submitted successfully',
            suggestionId: suggestion.rows[0].id
        });

    } catch (error) {
        console.error('Error submitting suggestion:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. Expert login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find expert user
        const result = await pool.query(
            'SELECT * FROM contributors WHERE email = $1 AND is_expert = true AND is_active = true',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // For demo purposes, allow simple password check
        // In production, use proper bcrypt hashing
        const validPassword = password === 'admin123' || 
            (user.password_hash && await bcrypt.compare(password, user.password_hash));

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Update last login
        await pool.query(
            'UPDATE contributors SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. Validate expert token
app.get('/api/admin/validate', verifyExpert, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email
        }
    });
});

// 4. Get dashboard statistics
app.get('/api/admin/stats', verifyExpert, async (req, res) => {
    try {
        // Get pending suggestions count
        const pending = await pool.query(
            'SELECT COUNT(*) FROM dictionary_suggestions WHERE status = $1',
            ['pending']
        );

        // Get today's approved/rejected counts
        const today = new Date().toISOString().split('T')[0];
        const approvedToday = await pool.query(
            'SELECT COUNT(*) FROM dictionary_suggestions WHERE status = $1 AND DATE(reviewed_at) = $2',
            ['approved', today]
        );

        const rejectedToday = await pool.query(
            'SELECT COUNT(*) FROM dictionary_suggestions WHERE status = $1 AND DATE(reviewed_at) = $2',
            ['rejected', today]
        );

        // Get active contributors count
        const activeContributors = await pool.query(
            'SELECT COUNT(DISTINCT contributor_id) FROM dictionary_suggestions WHERE created_at >= NOW() - INTERVAL \'30 days\''
        );

        res.json({
            pending: parseInt(pending.rows[0].count),
            approvedToday: parseInt(approvedToday.rows[0].count),
            rejectedToday: parseInt(rejectedToday.rows[0].count),
            activeContributors: parseInt(activeContributors.rows[0].count)
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 5. Get suggestions for review
app.get('/api/admin/suggestions', verifyExpert, async (req, res) => {
    try {
        const {
            status = 'pending',
            type = '',
            sort = 'created_at',
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT 
                s.*,
                c.name as contributor_name,
                c.email as contributor_email,
                r.name as reviewer_name
            FROM dictionary_suggestions s
            JOIN contributors c ON s.contributor_id = c.id
            LEFT JOIN contributors r ON s.reviewed_by = r.id
            WHERE s.status = $1
        `;
        
        const params = [status];
        let paramCount = 1;

        if (type) {
            paramCount++;
            query += ` AND s.suggestion_type = $${paramCount}`;
            params.push(type);
        }

        // Add sorting
        const sortMap = {
            'created_at': 'ORDER BY s.created_at DESC',
            'created_at_asc': 'ORDER BY s.created_at ASC',
            'contributor': 'ORDER BY c.name ASC'
        };
        query += ` ${sortMap[sort] || sortMap['created_at']}`;

        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(limit);

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 6. Get single suggestion details
app.get('/api/admin/suggestions/:id', verifyExpert, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                s.*,
                c.name as contributor_name,
                c.email as contributor_email,
                r.name as reviewer_name
            FROM dictionary_suggestions s
            JOIN contributors c ON s.contributor_id = c.id
            LEFT JOIN contributors r ON s.reviewed_by = r.id
            WHERE s.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Suggestion not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching suggestion:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 7. Review suggestion (approve/reject)
app.post('/api/admin/suggestions/:id/review', verifyExpert, async (req, res) => {
    try {
        const { id } = req.params;
        const { decision, notes } = req.body;

        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ message: 'Decision must be "approved" or "rejected"' });
        }

        // Get suggestion details
        const suggestionResult = await pool.query(
            'SELECT * FROM dictionary_suggestions WHERE id = $1',
            [id]
        );

        if (suggestionResult.rows.length === 0) {
            return res.status(404).json({ message: 'Suggestion not found' });
        }

        const suggestion = suggestionResult.rows[0];

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update suggestion status
            await client.query(`
                UPDATE dictionary_suggestions 
                SET status = $1, reviewed_by = $2, reviewed_at = NOW(), reviewer_notes = $3
                WHERE id = $4
            `, [decision, req.user.id, notes, id]);

            // If approved, apply changes to dictionary
            if (decision === 'approved') {
                if (suggestion.suggestion_type === 'addition') {
                    // Add new entry
                    const newEntry = await client.query(`
                        INSERT INTO dictionary_entries (
                            word_konkani_devanagari,
                            word_konkani_english_alphabet,
                            english_meaning,
                            context_usage_sentence
                        ) VALUES ($1, $2, $3, $4)
                        RETURNING *
                    `, [
                        suggestion.suggested_word_konkani_devanagari,
                        suggestion.suggested_word_konkani_english_alphabet,
                        suggestion.suggested_english_meaning,
                        suggestion.suggested_context_usage_sentence
                    ]);

                    // Log the change
                    await client.query(`
                        INSERT INTO dictionary_change_log (
                            entry_id, suggestion_id, change_type, 
                            new_values, changed_by, approved_by
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        newEntry.rows[0].id,
                        suggestion.id,
                        'addition',
                        JSON.stringify({
                            word_konkani_devanagari: suggestion.suggested_word_konkani_devanagari,
                            word_konkani_english_alphabet: suggestion.suggested_word_konkani_english_alphabet,
                            english_meaning: suggestion.suggested_english_meaning,
                            context_usage_sentence: suggestion.suggested_context_usage_sentence
                        }),
                        suggestion.contributor_id,
                        req.user.id
                    ]);

                } else if (suggestion.suggestion_type === 'correction' && suggestion.original_entry_id) {
                    // Get current entry for logging
                    const currentEntry = await client.query(
                        'SELECT * FROM dictionary_entries WHERE id = $1',
                        [suggestion.original_entry_id]
                    );

                    // Update existing entry
                    await client.query(`
                        UPDATE dictionary_entries 
                        SET 
                            word_konkani_devanagari = COALESCE($1, word_konkani_devanagari),
                            word_konkani_english_alphabet = COALESCE($2, word_konkani_english_alphabet),
                            english_meaning = COALESCE($3, english_meaning),
                            context_usage_sentence = COALESCE($4, context_usage_sentence),
                            updated_at = NOW()
                        WHERE id = $5
                    `, [
                        suggestion.suggested_word_konkani_devanagari,
                        suggestion.suggested_word_konkani_english_alphabet,
                        suggestion.suggested_english_meaning,
                        suggestion.suggested_context_usage_sentence,
                        suggestion.original_entry_id
                    ]);

                    // Log the change
                    await client.query(`
                        INSERT INTO dictionary_change_log (
                            entry_id, suggestion_id, change_type,
                            old_values, new_values, changed_by, approved_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        suggestion.original_entry_id,
                        suggestion.id,
                        'correction',
                        JSON.stringify(currentEntry.rows[0]),
                        JSON.stringify({
                            word_konkani_devanagari: suggestion.suggested_word_konkani_devanagari,
                            word_konkani_english_alphabet: suggestion.suggested_word_konkani_english_alphabet,
                            english_meaning: suggestion.suggested_english_meaning,
                            context_usage_sentence: suggestion.suggested_context_usage_sentence
                        }),
                        suggestion.contributor_id,
                        req.user.id
                    ]);
                }

                // Update contributor's approved count
                await client.query(
                    'UPDATE contributors SET approved_contributions = approved_contributions + 1 WHERE id = $1',
                    [suggestion.contributor_id]
                );
            }

            await client.query('COMMIT');
            res.json({ message: `Suggestion ${decision} successfully` });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error reviewing suggestion:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// END CROWDSOURCING SYSTEM
// ==========================================

// Migration endpoint for crowdsourcing tables
app.post('/api/migrate-crowdsourcing', async (req, res) => {
  try {
    console.log('🚀 Running crowdsourcing migration...');

    // Create tables
    await pool.query(`
      -- Users/Contributors table
      CREATE TABLE IF NOT EXISTS contributors (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    `);

    await pool.query(`
      -- Suggested changes/additions
      CREATE TABLE IF NOT EXISTS dictionary_suggestions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        original_entry_id UUID REFERENCES dictionary_entries(id),
        contributor_id UUID REFERENCES contributors(id),
        suggestion_type VARCHAR(20) CHECK (suggestion_type IN ('correction', 'addition', 'deletion')),
        
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
        
        -- Metadata
        contributor_notes TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_review')),
        
        -- Review information
        reviewed_by UUID REFERENCES contributors(id),
        reviewed_at TIMESTAMP,
        reviewer_notes TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      -- Suggestion votes/ratings
      CREATE TABLE IF NOT EXISTS suggestion_votes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        suggestion_id UUID REFERENCES dictionary_suggestions(id),
        contributor_id UUID REFERENCES contributors(id),
        vote_type VARCHAR(10) CHECK (vote_type IN ('helpful', 'not_helpful')),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(suggestion_id, contributor_id)
      );
    `);

    await pool.query(`
      -- Change history/audit log
      CREATE TABLE IF NOT EXISTS dictionary_change_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        entry_id UUID REFERENCES dictionary_entries(id),
        suggestion_id UUID REFERENCES dictionary_suggestions(id),
        change_type VARCHAR(20),
        old_values JSONB,
        new_values JSONB,
        changed_by UUID REFERENCES contributors(id),
        approved_by UUID REFERENCES contributors(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_suggestions_status ON dictionary_suggestions(status);
      CREATE INDEX IF NOT EXISTS idx_suggestions_contributor ON dictionary_suggestions(contributor_id);
      CREATE INDEX IF NOT EXISTS idx_suggestions_entry ON dictionary_suggestions(original_entry_id);
      CREATE INDEX IF NOT EXISTS idx_suggestions_created ON dictionary_suggestions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_contributors_expert ON contributors(is_expert);
      CREATE INDEX IF NOT EXISTS idx_change_log_entry ON dictionary_change_log(entry_id);
    `);

    // Insert sample expert users
    await pool.query(`
      INSERT INTO contributors (email, name, is_expert, is_active) VALUES 
      ('expert@konkani.org', 'Dr. Konkani Expert', TRUE, TRUE),
      ('admin@konkani.org', 'Dictionary Admin', TRUE, TRUE)
      ON CONFLICT (email) DO NOTHING;
    `);

    res.json({ 
      message: 'Crowdsourcing migration completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      message: error.message
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Temporary debug endpoint to check suggestions data
app.get('/api/debug/suggestions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                suggestion_type,
                suggested_devanagari,
                suggested_english_alphabet,
                suggested_meaning,
                suggested_context_usage_sentence,
                created_at,
                status
            FROM dictionary_suggestions 
            WHERE suggested_devanagari LIKE '%आम्चिगेले%' 
            OR suggested_english_alphabet LIKE '%amchigele%'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        res.json({
            count: result.rows.length,
            suggestions: result.rows
        });
    } catch (error) {
        console.error('Debug suggestions error:', error);
        res.status(500).json({ error: error.message });
    }
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
  console.log('  GET /api/debug/suggestions - Debug suggestions data');
});

module.exports = app;