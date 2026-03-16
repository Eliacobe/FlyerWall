import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildExtractionPrompt() {
    const today = new Date().toISOString().slice(0, 10);
    return `You are an information extraction assistant. The image provided is an event flyer or poster.

Today's date is ${today}. Use this to resolve any dates that are missing a year.

Extract the following fields and return ONLY a valid JSON object — no markdown, no explanation:

{
  "title": "string or null",
  "description": "string or null",
  "venue": "string or null",
  "starts_at": "ISO 8601 datetime string or null",
  "price": "string or null (e.g. 'Free', '£10', '$5–$15')",
  "organiser": "string or null",
  "tags": ["array", "of", "relevant", "category", "tags"]
}

Rules:
- Use null for any field you cannot confidently extract.
- For starts_at, convert to ISO 8601. If no year is shown on the flyer, use the nearest upcoming date from today (${today}). Never assume a past year.
- Keep description concise (max 2–3 sentences).
- Tags should be short lowercase genre or category strings only (e.g. "music", "comedy", "club night", "live music", "arts", "festival", "free", "theatre", "sports", "food"). Do NOT include location names, venue names, or organiser names as tags.
- Return ONLY the JSON object. No extra text.`;
}

export async function validateIsFlyer(imageBuffer, mimetype) {
    const base64Image = imageBuffer.toString('base64');

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: mimetype, data: base64Image },
                    },
                    {
                        type: 'text',
                        text: 'Is this image an event flyer, event poster, or promotional material for a specific event? Reply with only "yes" or "no".',
                    },
                ],
            },
        ],
    });

    const answer = response.content[0]?.text?.trim().toLowerCase() || 'no';
    return answer.startsWith('yes');
}

export async function extractFlyerInfo(imageBuffer, mimetype) {
    const base64Image = imageBuffer.toString('base64');

    const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimetype,
                            data: base64Image,
                        },
                    },
                    {
                        type: 'text',
                        text: buildExtractionPrompt(),
                    },
                ],
            },
        ],
    });

    const raw = response.content[0]?.text?.trim();
    if (!raw) throw new Error('Claude returned an empty response');

    try {
        return JSON.parse(raw);
    } catch {
        const cleaned = raw.replace(/^```json?\n?/, '').replace(/```$/, '').trim();
        return JSON.parse(cleaned);
    }
}