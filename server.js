const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// הגשת קבצים סטטיים
app.use(express.static('.'));

// route לקבלת הגדרות
app.get('/config', (req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    API_KEY: process.env.API_KEY
  });
});

// נתיב ראשי
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
