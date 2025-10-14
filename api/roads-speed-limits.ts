import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_SPEED_LIMITS_ENDPOINT = 'https://roads.googleapis.com/v1/speedLimits';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GOOGLE_ROADS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GOOGLE_ROADS_API_KEY is not configured' });
    }

    const pathQuery = req.query.path;
    const unitsQuery = req.query.units;

    const path = Array.isArray(pathQuery) ? pathQuery[0] : pathQuery;
    const units = Array.isArray(unitsQuery) ? unitsQuery[0] : unitsQuery;

    if (!path) {
        return res.status(400).json({ error: 'path query parameter is required' });
    }

    const params = new URLSearchParams({
        path,
        units: typeof units === 'string' && units.length > 0 ? units : 'KPH',
        key: apiKey
    });

    try {
        const response = await fetch(`${GOOGLE_SPEED_LIMITS_ENDPOINT}?${params.toString()}`);

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).send(text || '');
        }

        const data = await response.json();
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
        return res.status(200).json(data);
    } catch (error) {
        console.error('Roads speed limits proxy error:', error);
        return res.status(502).json({ error: 'Failed to fetch speed limits data' });
    }
}
