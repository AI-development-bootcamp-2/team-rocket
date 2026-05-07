'use strict';

// Set timezone before any Date operations
process.env.TZ = process.env.TZ || 'Asia/Jerusalem';

require('dotenv').config();

const app = require('./app');
const { initCron } = require('./cron');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (NODE_ENV=${process.env.NODE_ENV})`);
  initCron();
});
