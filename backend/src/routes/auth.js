import { Router } from 'express';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'flyerwall-dev-secret';

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

router.post('/register', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username?.trim() || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain an uppercase letter' });
        }
        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain a number' });
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain a special character' });
        }

        const { rows: existing } = await pool.query(
            'SELECT id FROM users WHERE display_name = $1',
            [username.trim()]
        );
        if (existing.length) {
            return res.status(409).json({ error: 'That username is already taken' });
        }

        const { rows } = await pool.query(
            'INSERT INTO users (display_name, password) VALUES ($1, $2) RETURNING id, display_name',
            [username.trim(), sha256(password)]
        );

        const token = jwt.sign(
            { userId: rows[0].id, username: rows[0].display_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        return res.status(201).json({ token, username: rows[0].display_name });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username already taken' });
        }
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username?.trim() || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const { rows } = await pool.query(
            'SELECT id, display_name, password FROM users WHERE display_name = $1',
            [username.trim()]
        );
        if (!rows.length || rows[0].password !== sha256(password)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { userId: rows[0].id, username: rows[0].display_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        return res.json({ token, username: rows[0].display_name });
    } catch (err) {
        next(err);
    }
});

export default router;
