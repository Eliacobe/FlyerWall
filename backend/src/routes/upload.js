import { Router } from 'express';
import upload from '../middleware/upload.js';
import { uploadFlyerImage } from '../services/storage.js';
import { extractFlyerInfo, validateIsFlyer } from '../services/extraction.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import pool from '../db/pool.js';

const router = Router();

await pool.query(`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id)
`);

router.post('/', requireAuth, upload.single('flyer'), async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided. Send a multipart field named "flyer".' });
    }

    const { buffer, mimetype, originalname } = req.file;

    try {
        console.log('  Validating image is a flyer...');
        const isFlyer = await validateIsFlyer(buffer, mimetype);
        if (!isFlyer) {
            return res.status(400).json({ error: "This doesn't look like an event flyer. Please upload a flyer or poster for a specific event." });
        }

        console.log('  Uploading image to Supabase Storage...');
        const imageUrl = await uploadFlyerImage(buffer, originalname, mimetype);
        console.log('  Uploaded:', imageUrl);

        console.log('  Sending to Claude for extraction...');
        let extracted = {};
        let needsReview = false;
        let extractionError = null;

        try {
            extracted = await extractFlyerInfo(buffer, mimetype);
            console.log('  Extraction complete:', extracted);
        } catch (extractionErr) {
            console.error('  Extraction failed:', extractionErr);
            needsReview = true;
            extractionError = extractionErr.message;
        }

        const { title, description, venue, starts_at, price, organiser, tags = [] } = extracted;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO events
           (title, description, venue, starts_at, price, organiser, image_url, extracted_json, needs_review, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
                [
                    title || 'Untitled Event',
                    description || null,
                    venue || null,
                    starts_at || null,
                    price || null,
                    organiser || null,
                    imageUrl,
                    JSON.stringify(extracted),
                    needsReview,
                    req.user.userId,
                ]
            );

            const event = rows[0];

            if (Array.isArray(tags) && tags.length > 0) {
                for (const tagName of tags) {
                    const normalised = tagName.toLowerCase().trim();
                    if (!normalised) continue;

                    const { rows: tagRows } = await client.query(
                        `INSERT INTO tags (name) VALUES ($1)
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
                        [normalised]
                    );
                    const tagId = tagRows[0].id;

                    await client.query(
                        `INSERT INTO event_tags (event_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                        [event.id, tagId]
                    );
                }
            }

            await client.query('COMMIT');

            return res.status(201).json({
                message: 'Flyer uploaded and processed successfully.',
                event: { ...event, tags },
                extractionError,
            });
        } catch (dbErr) {
            await client.query('ROLLBACK');
            throw dbErr;
        } finally {
            client.release();
        }
    } catch (err) {
        next(err);
    }
});

export default router;