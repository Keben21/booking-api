const express = require("express");
const { Pool } = require("pg");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post("/", protect, requireAdmin, async (req, res) => {
  try {
    const { name, event_date, total_capacity } = req.body;

    const newEvent = await pool.query(
      `INSERT INTO events (name, event_date, total_capacity, available_spots, is_published)
       VALUES ($1, $2, $3, $3, true) RETURNING *`,
      [name, event_date, total_capacity],
    );

    res.status(201).json(newEvent.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", err: err.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const events = await pool.query(
      "SELECT * FROM events WHERE is_published = true ORDER BY event_date ASC",
    );
    res.json(events.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error", err: err.message });
  }
});

module.exports = router;
