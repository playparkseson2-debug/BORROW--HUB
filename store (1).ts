/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// GET  /api/store        -> { users, items, requests, notifications, configured }
// POST /api/store        -> body: { collection: 'users'|'items'|'requests'|'notifications', data }
//
// This is the single shared "database" endpoint every browser/device calls,
// instead of only reading/writing localStorage. See api/_lib/store.ts for
// the one-time Upstash Redis setup this depends on.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readAllCollections, writeCollection, isCollection, isDatabaseConfigured } from './_lib/store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const data = await readAllCollections();
      if (!data) {
        return res.status(503).json({
          configured: false,
          error: 'Database not configured yet (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing)',
        });
      }
      return res.status(200).json({ ...data, configured: true });
    }

    if (req.method === 'POST') {
      const { collection, data } = (req.body || {}) as { collection?: string; data?: unknown };
      if (!isCollection(collection)) {
        return res.status(400).json({ error: `invalid collection: ${collection}` });
      }
      if (!isDatabaseConfigured()) {
        return res.status(503).json({ configured: false, error: 'Database not configured yet' });
      }
      await writeCollection(collection, data);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err: any) {
    console.error('[api/store] error:', err);
    return res.status(500).json({ error: err?.message || 'internal error' });
  }
}
