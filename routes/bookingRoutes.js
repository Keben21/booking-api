const express = require("express");
const { Pool } = require("pg");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post("/:eventId/hold", protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { quantity } = req.body;

    const result = await pool.query(
      `UPDATE events
       SET available_spots = available_spots - $1
       WHERE id = $2 AND available_spots >= $1
       RETURNING *`,
      [quantity, eventId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Not enough spots available" });
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const booking = await pool.query(
      `INSERT INTO bookings (user_id, event_id, quantity, status, hold_expires_at)
       VALUES ($1, $2, $3, 'held', $4) RETURNING *`,
      [req.userId, eventId, quantity, expiresAt],
    );

    res.status(201).json(booking.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", err: err.message });
  }
});

router.put("/:bookingId/confirm", protect, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await pool.query(
      `UPDATE bookings
       SET status = 'confirmed'
       WHERE id = $1 AND user_id = $2 AND status = 'held' AND hold_expires_at > NOW()
       RETURNING *`,
      [bookingId, req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message:
          "Booking not found, not yours, already handled, or hold expired",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", err: err.message });
  }
});

router.put("/:bookingId/cancel", protect, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const booking = await client.query(
      `UPDATE bookings
       SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'held'
       RETURNING *`,
      [req.params.bookingId, req.userId],
    );

    if (booking.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Booking not found, not yours, or already handled" });
    }

    await client.query(
      `UPDATE events SET available_spots = available_spots + $1 WHERE id = $2`,
      [booking.rows[0].quantity, booking.rows[0].event_id],
    );

    await client.query("COMMIT");
    res.json(booking.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Server error", err: err.message });
  } finally {
    client.release();
  }
});

router.post("/expire-holds", protect, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const expired = await client.query(
      `UPDATE bookings
       SET status = 'expired'
       WHERE status = 'held' AND hold_expires_at <= NOW()
       RETURNING *`,
    );

    for (const booking of expired.rows) {
      await client.query(
        `UPDATE events SET available_spots = available_spots + $1 WHERE id = $2`,
        [booking.quantity, booking.event_id],
      );
    }

    await client.query("COMMIT");
    res.json({ expiredCount: expired.rows.length, expired: expired.rows });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Server error", err: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
