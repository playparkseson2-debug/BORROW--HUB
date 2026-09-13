/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Central, shared data store for BORROW HUB.
//
// WHY THIS FILE EXISTS:
// The app used to keep users/items/requests/notifications only in the
// browser's localStorage. That meant every browser/device had its own
// separate copy of the data — so items added on one phone never showed up
// on another, and the same LINE account looked "unregistered" again on a
// different device. This module reads/writes ONE shared copy of that data
// in Upstash Redis (connected to this Vercel project via the Marketplace),
// so every device and every account sees the same data.
//
// SETUP REQUIRED (one-time, in the Vercel dashboard):
//   1. Vercel Project -> Storage tab -> Create Database -> "Upstash Redis"
//      (Marketplace integration) -> Connect to this project.
//   2. Vercel automatically adds the env vars this file reads
//      (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) to the project.
//      Redeploy once after connecting so the functions pick them up.
//   3. For local dev, copy the same two values into your local .env file.
//
// If these env vars are missing, every function below degrades gracefully
// (returns null / throws a clear "not configured" error) so the app still
// runs locally with localStorage-only behavior instead of crashing.

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;
let attemptedInit = false;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  if (attemptedInit) return null;
  attemptedInit = true;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  redisClient = new Redis({ url, token });
  return redisClient;
}

export const COLLECTIONS = ['users', 'items', 'requests', 'notifications'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export function isCollection(value: unknown): value is Collection {
  return typeof value === 'string' && (COLLECTIONS as readonly string[]).includes(value);
}

const keyFor = (c: Collection) => `borrowhub:${c}`;

/** Returns null when the database isn't configured yet (see setup notes above). */
export async function readAllCollections(): Promise<Record<Collection, unknown> | null> {
  const client = getRedis();
  if (!client) return null;

  const values = await Promise.all(COLLECTIONS.map((c) => client.get(keyFor(c))));
  const result = {} as Record<Collection, unknown>;
  COLLECTIONS.forEach((c, i) => {
    result[c] = values[i];
  });
  return result;
}

export function isDatabaseConfigured(): boolean {
  return getRedis() !== null;
}

export async function writeCollection(collection: Collection, data: unknown): Promise<void> {
  const client = getRedis();
  if (!client) {
    throw new Error('Database not configured (missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)');
  }
  await client.set(keyFor(collection), data);
}
