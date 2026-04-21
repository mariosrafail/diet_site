const express = require('express');
const path = require('path');
const { app, ensureSchema } = require('./backend-app');

app.use(express.static(path.join(__dirname)));

const PORT = Number(process.env.PORT || 3000);

async function start() {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Diet site backend listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
