const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/fetch-lyrics', async (req, res) => {
  const { searchQuery } = req.body;
  
  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // Run the Python script with the search query
    const python = spawn('python3', [
      '-c', 
      `
import syncedlyrics
import json
import sys

search_term = """${searchQuery}"""
try:
    lyrics = syncedlyrics.search(search_term)
    if lyrics:
        print(json.dumps({"lyrics": lyrics}))
    else:
        print(json.dumps({"error": "No lyrics found"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
      `
    ]);

    let data = '';
    
    python.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });

    python.stderr.on('data', (chunk) => {
      console.error('Python stderr:', chunk.toString());
    });

    python.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: `Python process exited with code ${code}` });
      }
      
      try {
        const result = JSON.parse(data);
        return res.json(result);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse Python output', details: e.message, data });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Lyrics API server running on port ${PORT}`);
});