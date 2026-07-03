import { Logger } from '@nestjs/common';
import { CalendarPort } from '../ports';

/**
 * Google Calendar adapter (CalendarPort). The Dispatch agent uses freeBusy to
 * avoid double-booking technicians and createEvent to confirm bookings with
 * two-way sync (Booking.calendarEventId). Wire the official googleapis client in
 * the marked spots; OAuth tokens live in the tenant Integration row.
 */
export class GoogleCalendarAdapter implements CalendarPort {
  private readonly logger = new Logger(GoogleCalendarAdapter.name);

  constructor(private readonly creds: { accessToken?: string; calendarId?: string }) {}

  async createEvent(input: { start: Date; end: Date; summary: string; attendees?: string[] }) {
    if (!this.creds.accessToken) {
      this.logger.warn(`[stub] CALENDAR event "${input.summary}" ${input.start.toISOString()}`);
      return { eventId: `stub_${Date.now()}` };
    }
    const calId = encodeURIComponent(this.creds.calendarId ?? 'primary');
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.creds.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: input.summary,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
        attendees: input.attendees?.map((email) => ({ email })),
      }),
    });
    if (!res.ok) throw new Error(`GCal ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return { eventId: data.id };
  }

  async freeBusy(input: { start: Date; end: Date; calendarId?: string }) {
    if (!this.creds.accessToken) return { busy: [] };
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.creds.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: input.start.toISOString(),
        timeMax: input.end.toISOString(),
        items: [{ id: input.calendarId ?? this.creds.calendarId ?? 'primary' }],
      }),
    });
    if (!res.ok) throw new Error(`GCal freeBusy ${res.status}`);
    const data: any = await res.json();
    const cal = Object.values<any>(data.calendars ?? {})[0];
    return {
      busy: (cal?.busy ?? []).map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) })),
    };
  }
}
