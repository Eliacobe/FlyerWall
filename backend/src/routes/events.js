import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', async (req, res, next) => {
    try
    {
        const { q, from, to, tag, date} = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (q)
        {
            conditions.push(`e.search_tsv @@ plainto_tsquery('english', $${paramIdx++})`);
            params.push(q);
        }
        if (date)
        {
            conditions.push(`DATE(e.starts_at) = $${paramIdx++}::date`);
            params.push(date);
        }
        else
        {
            if (from)
            {
                conditions.push(`e.starts_at >= $${paramIdx++}`);
                params.push(from);
            }
            if (to)
            {
                conditions.push(`e.starts_at <= $${paramIdx++}`);
                params.push(to);
            }
        }

        let tagJoin = '';
        if (tag) 
        {
            tagJoin = `
        JOIN event_tags et ON et.event_id = e.id
        JOIN tags t ON t.id = et.tag_id AND t.name = $${paramIdx++}
      `;
            params.push(tag.toLowerCase().trim());
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
      SELECT
        e.id, e.title, e.description, e.venue, e.starts_at,
        e.price, e.organiser, e.image_url, e.needs_review, e.created_at,
        COALESCE(
          json_agg(DISTINCT tg.name) FILTER (WHERE tg.name IS NOT NULL),
          '[]'
        ) AS tags
      FROM events e
      ${tagJoin}
      LEFT JOIN event_tags etg ON etg.event_id = e.id
      LEFT JOIN tags tg ON tg.id = etg.tag_id
      ${where}
      GROUP BY e.id
      ORDER BY e.starts_at ASC NULLS LAST, e.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
        params.push(limit, offset);

        const countSql = `
      SELECT COUNT(DISTINCT e.id) AS total
      FROM events e
      ${tagJoin}
      ${where}
    `;

        const [{ rows }, { rows: countRows }] = await Promise.all([
            pool.query(sql, params),
            pool.query(countSql, params.slice(0, params.length - 2)),
        ]);

        return res.json({
            data: rows,
            pagination: {
                page,
                limit,
                total: parseInt(countRows[0].total),
                totalPages: Math.ceil(countRows[0].total / limit),
            },
        });
    }
    catch (err)
    {
        next(err);
    }
});

router.get('/mine', requireAuth, async (req, res, next) => {
    try
    {
        const { rows} = await pool.query
        (
            `SELECT
               e.id, e.title, e.description, e.venue, e.starts_at,
               e.price, e.organiser, e.image_url, e.needs_review, e.created_at,
               COALESCE(
                 json_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL),
                 '[]'
               ) AS tags
             FROM events e
             LEFT JOIN event_tags et ON et.event_id = e.id
             LEFT JOIN tags t ON t.id = et.tag_id
             WHERE e.uploaded_by = $1
             GROUP BY e.id
             ORDER BY e.created_at DESC`,
            [req.user.userId]
        );
        return res.json({ data: rows });
    } 
    catch (err) 
    {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const {rows} = await pool.query
        (
            `SELECT
         e.*,
         COALESCE(
           json_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL),
           '[]'
         ) AS tags
       FROM events e
       LEFT JOIN event_tags et ON et.event_id = e.id
       LEFT JOIN tags t ON t.id = et.tag_id
       WHERE e.id = $1
       GROUP BY e.id`,
            [req.params.id]
        );

        if (!rows.length) return res.status(404).json({ error: 'Event not found' });
        return res.json(rows[0]);
    } 
    catch (err) 
    {
        next(err);
    }
});

router.patch('/:id', async (req, res, next) => {
    try 
    {
        const allowed = ['title', 'description', 'venue', 'starts_at', 'price', 'organiser'];
        const updates = [];
        const params = [];
        let idx = 1;

        for (const field of allowed) {
            if (req.body[field] !== undefined)
            {
                updates.push(`${field} = $${idx++}`);
                params.push(req.body[field]);
            }
        }

        if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

        updates.push(`needs_review = false`);
        params.push(req.params.id);

        const {rows} = await pool.query
        (
            `UPDATE events SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        if (!rows.length) return res.status(404).json({ error: 'Event not found' });
        return res.json(rows[0]);
    } 
    catch (err) 
    {
        next(err);
    }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
    try 
    {
        const { rows} = await pool.query
        (
            'SELECT uploaded_by FROM events WHERE id = $1',
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Event not found' });
        if (rows[0].uploaded_by !== req.user.userId)
        {
            return res.status(403).json({ error: 'You can only delete your own flyers' });
        }
        await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
        return res.json({ message: 'Event deleted successfully' });
    } 
    catch (err)
    {
        next(err);
    }
});

export default router;