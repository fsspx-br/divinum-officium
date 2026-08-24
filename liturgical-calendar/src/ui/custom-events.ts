import type { CalendarDay } from '@engine/types';
import { escapeHtml } from './app-utils';
import { t } from './i18n/i18n';

export interface CustomEvent {
  uid: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: 'America/Sao_Paulo';
  location: string;
  description: string;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  revision: string;
}

export interface EventInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: 'America/Sao_Paulo';
  location: string;
  description: string;
}

async function apiError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    return new Error(body.details?.join('. ') || body.error || `HTTP ${response.status}`);
  } catch {
    return new Error(`HTTP ${response.status}`);
  }
}

export async function getCustomEvents(from: string, to: string): Promise<CustomEvent[]> {
  const response = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!response.ok) throw await apiError(response);
  const body = await response.json();
  return Array.isArray(body.events) ? body.events : [];
}

export async function getCanManageEvents(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/capabilities');
    if (!response.ok) return false;
    return Boolean((await response.json()).canManageEvents);
  } catch {
    return false;
  }
}

export async function createCustomEvent(input: EventInput): Promise<CustomEvent> {
  const response = await fetch('/api/admin/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await apiError(response);
  return response.json();
}

export async function updateCustomEvent(event: CustomEvent, input: EventInput): Promise<CustomEvent> {
  const response = await fetch(`/api/admin/events/${encodeURIComponent(event.uid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': event.revision },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await apiError(response);
  return response.json();
}

export async function deleteCustomEvent(event: CustomEvent): Promise<void> {
  const response = await fetch(`/api/admin/events/${encodeURIComponent(event.uid)}`, {
    method: 'DELETE',
    headers: { 'If-Match': event.revision },
  });
  if (!response.ok) throw await apiError(response);
}

function inputValue(form: HTMLFormElement, name: string): string {
  return (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value;
}

export interface DayDialogOptions {
  day: CalendarDay;
  events: CustomEvent[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}

export function openDayEvents(options: DayDialogOptions): void {
  document.querySelector('.event-modal-backdrop')?.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'event-modal-backdrop';
  backdrop.innerHTML = `
    <section class="event-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
      <header class="event-modal-header">
        <div>
          <h2 id="event-modal-title">${escapeHtml(t('events.dayTitle').replace('{date}', options.day.date))}</h2>
          <p>${escapeHtml(options.day.celebration.name)}</p>
        </div>
        <button type="button" class="event-modal-close" aria-label="${escapeHtml(t('events.close'))}">×</button>
      </header>
      <div class="event-modal-content"></div>
    </section>`;
  document.body.appendChild(backdrop);

  const modal = backdrop.querySelector('.event-modal') as HTMLElement;
  const content = backdrop.querySelector('.event-modal-content') as HTMLElement;
  const keyHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  const close = () => {
    document.removeEventListener('keydown', keyHandler);
    backdrop.remove();
  };
  backdrop.querySelector('.event-modal-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  document.addEventListener('keydown', keyHandler);

  function renderList(): void {
    content.innerHTML = '';
    const sorted = [...options.events].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'event-empty';
      empty.textContent = t('events.none');
      content.appendChild(empty);
    }

    for (const event of sorted) {
      const item = document.createElement('article');
      item.className = 'event-item';
      item.innerHTML = `
        <div class="event-item-main">
          <time>${escapeHtml(event.startTime)}–${escapeHtml(event.endTime)}</time>
          <strong>${escapeHtml(event.title)}</strong>
          ${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}
          ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}
        </div>
        ${options.canManage ? '<div class="event-item-actions"><button type="button" data-action="edit"></button><button type="button" class="danger" data-action="delete"></button></div>' : ''}`;
      if (options.canManage) {
        const editButton = item.querySelector('[data-action="edit"]') as HTMLButtonElement;
        const deleteButton = item.querySelector('[data-action="delete"]') as HTMLButtonElement;
        editButton.textContent = t('events.edit');
        deleteButton.textContent = t('events.delete');
        editButton.addEventListener('click', () => renderForm(event));
        deleteButton.addEventListener('click', async () => {
          if (!window.confirm(t('events.deleteConfirm'))) return;
          deleteButton.disabled = true;
          try {
            await deleteCustomEvent(event);
            close();
            await options.onChanged();
          } catch (error) {
            deleteButton.disabled = false;
            window.alert(error instanceof Error ? error.message : String(error));
          }
        });
      }
      content.appendChild(item);
    }

    if (options.canManage) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'event-add';
      add.textContent = t('events.add');
      add.addEventListener('click', () => renderForm());
      content.appendChild(add);
    }
  }

  function renderForm(existing?: CustomEvent): void {
    content.innerHTML = `
      <form class="event-form">
        <label>${escapeHtml(t('events.title'))}<input name="title" maxlength="200" required value="${escapeHtml(existing?.title ?? '')}"></label>
        <label>${escapeHtml(t('events.date'))}<input name="date" type="date" required value="${escapeHtml(existing?.date ?? options.day.date)}"></label>
        <div class="event-form-times">
          <label>${escapeHtml(t('events.start'))}<input name="startTime" type="time" required value="${escapeHtml(existing?.startTime ?? '09:00')}"></label>
          <label>${escapeHtml(t('events.end'))}<input name="endTime" type="time" required value="${escapeHtml(existing?.endTime ?? '10:00')}"></label>
        </div>
        <label>${escapeHtml(t('events.location'))}<input name="location" maxlength="300" value="${escapeHtml(existing?.location ?? '')}"></label>
        <label>${escapeHtml(t('events.description'))}<textarea name="description" maxlength="5000" rows="4">${escapeHtml(existing?.description ?? '')}</textarea></label>
        <p class="event-form-error" role="alert"></p>
        <div class="event-form-actions">
          <button type="button" data-action="cancel">${escapeHtml(t('events.cancel'))}</button>
          <button type="submit" class="primary">${escapeHtml(t('events.save'))}</button>
        </div>
      </form>`;
    const form = content.querySelector('form') as HTMLFormElement;
    const errorElement = content.querySelector('.event-form-error') as HTMLElement;
    content.querySelector('[data-action="cancel"]')?.addEventListener('click', renderList);
    form.addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      const submit = form.querySelector('[type="submit"]') as HTMLButtonElement;
      const input: EventInput = {
        title: inputValue(form, 'title'),
        date: inputValue(form, 'date'),
        startTime: inputValue(form, 'startTime'),
        endTime: inputValue(form, 'endTime'),
        timeZone: 'America/Sao_Paulo',
        location: inputValue(form, 'location'),
        description: inputValue(form, 'description'),
      };
      if (input.endTime <= input.startTime) {
        errorElement.textContent = t('events.invalidTime');
        return;
      }
      submit.disabled = true;
      errorElement.textContent = '';
      try {
        if (existing) await updateCustomEvent(existing, input);
        else await createCustomEvent(input);
        close();
        await options.onChanged();
      } catch (error) {
        submit.disabled = false;
        errorElement.textContent = error instanceof Error ? error.message : String(error);
      }
    });
    (form.elements.namedItem('title') as HTMLInputElement).focus();
  }

  renderList();
  (modal.querySelector('.event-modal-close') as HTMLButtonElement).focus();
}
