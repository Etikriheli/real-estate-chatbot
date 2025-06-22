const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// הגשת קבצים סטטיים
app.use(express.static('.'));

// נתיב ראשי
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});