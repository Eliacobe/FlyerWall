import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db/pool.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseQuery(query, today)
{
    const prompt = `Today's date is ${today}.

The user is searching for events on a flyer board. Parse their natural language query into structured search filters.

User query: "${query}"

Return ONLY a valid JSON object with these fields:
{
  "q": "keyword string for full-text search, or null if no specific keywords",
  "tag": "single genre/category tag to filter by (e.g. 'comedy', 'music', 'club night'), or null",
  "from": "ISO 8601 date-time for start of date range, or null",
  "to": "ISO 8601 date-time for end of date range, or null",
  "interpretation": "short human-readable sentence describing what you're searching for"
}

Rules:
- For date expressions like "the 19th", use the current month and year unless context suggests otherwise.
- "this weekend" = the upcoming Saturday and Sunday.
- "tonight" = today's date.
- "next week" = Monday to Sunday of the next calendar week.
- For a single day, set from = start of that day (00:00:00) and to = end of that day (23:59:59).
- Only set "tag" if the query clearly refers to a genre or event category.
- Only set "q" if there are specific keywords (e.g. event name, artist, venue) beyond a category.
- Return ONLY the JSON. No extra text.`;

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0]?.text?.trim();
    try
    {
        return JSON.parse(raw);
    }
    catch
    {
        const cleaned = raw.replace(/^```json?\n?/, '').replace(/```$/, '').trim();
        return JSON.parse(cleaned);
    }
}

router.post('/', async (req, res, next) => {
    try
    {
        const {query} = req.body;
        if (!query?.trim())
        {
            return res.status(400).json({ error: 'Query is required' });
        }

        const today = new Date().toISOString().slice(0, 10);
        const filters = await parseQuery(query.trim(), today);

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (filters.q)
        {
            conditions.push(`e.search_tsv @@ plainto_tsquery('english', $${paramIdx++})`);
            params.push(filters.q);
        }
        if (filters.from)
        {
            conditions.push(`e.starts_at >= $${paramIdx++}`);
            params.push(filters.from);
        }
        if (filters.to)
        {
            conditions.push(`e.starts_at <= $${paramIdx++}`);
            params.push(filters.to);
        }

        let tagJoin = '';
        if (filters.tag) 
        {
            tagJoin = `
        JOIN event_tags et ON et.event_id = e.id
        JOIN tags t ON t.id = et.tag_id AND t.name = $${paramIdx++}
      `;
            params.push(filters.tag.toLowerCase().trim());
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
      LIMIT 50
    `;

        const {rows} = await pool.query(sql, params);

        return res.json({
            data: rows,
            interpretation: filters.interpretation || null,
            filters,
        });
    } 
    catch (err) 
    {
        next(err);
    }
});

export default router;
