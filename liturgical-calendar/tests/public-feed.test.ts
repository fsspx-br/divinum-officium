import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { generatePublicFeed, generatePublicFeedChunks } from '../events-api/feed.js';

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
      abstinence: true,
      holyDayOfObligation: false,
    }]));
    await writeFile(join(dataDir, '3000.json.gz'), gzipSync(JSON.stringify([{
      date: '3000-12-25',
      season: 'christmas',
      color: 'white',
      celebration: { name: 'Natal do Senhor', rankName: 'Duplo I classe' },
      commemorations: [],
      abstinence: false,
      holyDayOfObligation: true,
    }])));
    const events = [{
      uid: 'custom@calendar.fsspx.br', title: 'Missa', date: '2026-09-23',
      startTime: '18:30', endTime: '19:30', timeZone: 'America/Sao_Paulo',
      location: '', description: '', sequence: 0,
      createdAt: '2026-08-24T12:00:00.000Z', updatedAt: '2026-08-24T12:00:00.000Z',
    }];
    const feed = await generatePublicFeed({ distDir: root, events, now: new Date('2026-08-24T12:00:00Z') });
    expect(feed.body).toContain('UID:20260923-rubrics-1960-pt@calendar.fsspx.br');
    expect(feed.body).toContain('SUMMARY:S. Lino\\, Papa e Mártir');
    expect(feed.body).toContain('Dia de Abstinência: Sim\\nDia de Preceito: Não');
    expect(feed.body).toContain('DTSTART;VALUE=DATE:30001225');
    expect(feed.body).toContain('SUMMARY:Natal do Senhor');
    expect(feed.body).toContain('Dia de Abstinência: Não\\nDia de Preceito: Sim');
    expect(feed.body).toContain('UID:custom@calendar.fsspx.br');
    expect(feed.body).toContain('DTSTART;TZID=America/Sao_Paulo:20260923T183000');
    expect(feed.etag).toMatch(/^"[a-f0-9]{64}"$/);

    const chunks: string[] = [];
    for await (const chunk of generatePublicFeedChunks({ distDir: root, events })) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(5); // header + two years + custom events + footer
    expect(chunks.join('')).toBe(feed.body);
  });
});
