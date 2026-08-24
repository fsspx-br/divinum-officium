import { eventFromIcs, eventResourceName, eventToIcs } from './event.js';

const COLLECTION_PATH = '/calendar-api/custom-events/';

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#13;/g, '\r')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

function extractXml(block, localName) {
  const regex = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${localName}>`, 'i');
  return decodeXml(block.match(regex)?.[1] ?? '');
}

export class CalDavStore {
  constructor({ baseUrl, username, password, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    this.fetchImpl = fetchImpl;
  }

  url(path = '') {
    return `${this.baseUrl}${COLLECTION_PATH}${path}`;
  }

  async request(path, options = {}) {
    const response = await this.fetchImpl(this.url(path), {
      ...options,
      headers: {
        Authorization: this.authorization,
        ...(options.headers ?? {}),
      },
    });
    return response;
  }

  async ensureCollection() {
    const body = `<?xml version="1.0" encoding="utf-8" ?>
      <C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
        <D:set><D:prop><D:displayname>Custom timed events</D:displayname></D:prop></D:set>
      </C:mkcalendar>`;
    const response = await this.request('', {
      method: 'MKCALENDAR',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body,
    });
    if ([201, 204].includes(response.status)) return;
    if ([405, 409].includes(response.status)) {
      const probe = await this.request('', {
        method: 'PROPFIND',
        headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
        body: '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>',
      });
      if (probe.status === 207) return;
    }
    throw new Error(`Could not initialize CalDAV collection (HTTP ${response.status})`);
  }

  async list(from, to) {
    const shiftDate = (value, days) => {
      const date = new Date(`${value}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10).replaceAll('-', '');
    };
    const timeRange = from && to
      // Query a slightly wider UTC window, then filter by local event date.
      // This avoids dropping late-night Sao Paulo events at year boundaries.
      ? `<C:time-range start="${shiftDate(from, -1)}T000000Z" end="${shiftDate(to, 1)}T000000Z"/>`
      : '';
    const body = `<?xml version="1.0" encoding="utf-8" ?>
      <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
        <D:prop><D:getetag/><C:calendar-data/></D:prop>
        <C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT">${timeRange}</C:comp-filter></C:comp-filter></C:filter>
      </C:calendar-query>`;
    const response = await this.request('', {
      method: 'REPORT',
      headers: {
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body,
    });
    if (!response.ok && response.status !== 207) {
      throw new Error(`CalDAV query failed (HTTP ${response.status})`);
    }
    const xml = await response.text();
    const blocks = xml.match(/<(?:[A-Za-z0-9_-]+:)?response(?:\s[^>]*)?>[\s\S]*?<\/(?:[A-Za-z0-9_-]+:)?response>/gi) ?? [];
    const events = blocks
      .map((block) => ({ ics: extractXml(block, 'calendar-data'), revision: extractXml(block, 'getetag') }))
      .filter(({ ics }) => ics.includes('BEGIN:VEVENT'))
      .map(({ ics, revision }) => eventFromIcs(ics, revision))
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
    return from && to
      ? events.filter((event) => event.date >= from && event.date < to)
      : events;
  }

  async get(uid) {
    const response = await this.request(eventResourceName(uid));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CalDAV GET failed (HTTP ${response.status})`);
    return eventFromIcs(await response.text(), response.headers.get('etag') ?? '');
  }

  async create(event) {
    const response = await this.request(eventResourceName(event.uid), {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'If-None-Match': '*',
      },
      body: eventToIcs(event),
    });
    if (![201, 204].includes(response.status)) {
      throw new Error(`CalDAV create failed (HTTP ${response.status})`);
    }
    return this.get(event.uid);
  }

  async update(event, revision) {
    const response = await this.request(eventResourceName(event.uid), {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'If-Match': revision,
      },
      body: eventToIcs(event),
    });
    if (response.status === 412) return { conflict: true };
    if (![201, 204].includes(response.status)) {
      throw new Error(`CalDAV update failed (HTTP ${response.status})`);
    }
    return this.get(event.uid);
  }

  async delete(uid, revision) {
    const response = await this.request(eventResourceName(uid), {
      method: 'DELETE',
      headers: { 'If-Match': revision },
    });
    if (response.status === 404) return { missing: true };
    if (response.status === 412) return { conflict: true };
    if (![200, 204].includes(response.status)) throw new Error(`CalDAV delete failed (HTTP ${response.status})`);
    return { ok: true };
  }
}

export { COLLECTION_PATH };
