import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePublicFeed } from '../events-api/feed.js';

describe('combined public ICS feed', () => {
  it('contains generated all-day and custom timed events with stable UIDs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'litcal-feed-'));
    const dataDir = join(root, 'data', 'pt', 'Rubrics-1960-1960');
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, '2026.json'), JSON.stringify([{
      date: '2026-09-23',
      season: 'pentecost',
      color: 'red',
      celebration: { name: 'S. Lino, Papa e Mártir', rankName: 'III classe' },
      commemorations: [],
    }]));
    const events = [{
      uid: 'custom@calendar.fsspx.br', title: 'Missa', date: '2026-09-23',
      startTime: '18:30', endTime: '19:30', timeZone: 'America/Sao_Paulo',
      location: '', description: '', sequence: 0,
      createdAt: '2026-08-24T12:00:00.000Z', updatedAt: '2026-08-24T12:00:00.000Z',
    }];
    const feed = await generatePublicFeed({ distDir: root, events, now: new Date('2026-08-24T12:00:00Z') });
    expect(feed.body).toContain('UID:20260923-rubrics-1960-pt@calendar.fsspx.br');
    expect(feed.body).toContain('SUMMARY:S. Lino\\, Papa e Mártir');
    expect(feed.body).toContain('UID:custom@calendar.fsspx.br');
    expect(feed.body).toContain('DTSTART;TZID=America/Sao_Paulo:20260923T183000');
    expect(feed.etag).toMatch(/^"[a-f0-9]{64}"$/);
  });
});
