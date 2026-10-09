require(`dotenv`).config();
const express = require(`express`);
const { Pool } = require(`pg`);
const authRoutes = require(`./routes/authRoutes`);
const eventRoutes = require(`./routes/eventRoutes`);
const bookingRoutes = require(`./routes/bookingRoutes`);

const app = express();
app.use(express.json());
app.use(`/api/auth`, authRoutes);
app.use(`/api/events`, eventRoutes);
app.use(`/api/bookings`, bookingRoutes);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query(`SELECT NOW()`, (err, result) => {
  if (err) {
    console.error(`Database connection error:`, err);
  } else {
    console.log(`PostgreSQL connected:`, result.rows[0].now);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
