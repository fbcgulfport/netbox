import { Toast } from 'bootstrap';
import { GridStack } from 'gridstack';

function numberFromDataset(element: HTMLElement, key: string, fallback: number): number {
  const value = element.dataset[key];
  if (typeof value === 'undefined' || value === '') return fallback;
  return Number(value);
}

function getCsrfToken(root: HTMLElement): string {
  return root.querySelector<HTMLInputElement>('input[name="csrfmiddlewaretoken"]')?.value ?? '';
}

function showToast(level: string, title: string, message: string): void {
  const container = document.createElement('div');
  container.className = 'toast-container position-fixed bottom-0 end-0 m-3';

  const toastElement = document.createElement('div');
  toastElement.className = 'toast';
  toastElement.setAttribute('role', 'alert');
  toastElement.setAttribute('aria-live', 'assertive');
  toastElement.setAttribute('aria-atomic', 'true');

  const header = document.createElement('div');
  header.className = `toast-header bg-${level}`;

  const icon = document.createElement('i');
  icon.className = level === 'success' ? 'mdi mdi-check-circle' : 'mdi mdi-alert';

  const titleElement = document.createElement('strong');
  titleElement.className = 'me-auto ms-1';
  titleElement.innerText = title;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-close';
  close.setAttribute('data-bs-dismiss', 'toast');
  close.setAttribute('aria-label', 'Close');

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.innerText = message;

  header.append(icon, titleElement, close);
  toastElement.append(header, body);
  container.append(toastElement);
  document.body.append(container);

  new Toast(toastElement).show();
}

function getPosition(root: HTMLElement, grid: HTMLElement, item: HTMLElement): number | null {
  if (grid.dataset.face === 'none') return null;

  const rackHeight = numberFromDataset(root, 'rackHeight', 0);
  const startingUnit = numberFromDataset(root, 'startingUnit', 1);
  const descUnits = root.dataset.descUnits === 'true';
  const node = (item as any).gridstackNode;
  const y = Number(node?.y ?? item.getAttribute('gs-y') ?? 0) / 2;
  const height = Number(node?.h ?? item.getAttribute('gs-h') ?? 1) / 2;

  if (descUnits) return startingUnit + y;
  return rackHeight + startingUnit - height - y;
}

function getPayload(root: HTMLElement, grids: GridStack[]): Record<string, unknown> {
  const devices: Record<string, unknown>[] = [];

  for (const grid of grids) {
    const gridElement = grid.el as HTMLElement;
    const face = gridElement.dataset.face ?? 'none';

    for (const item of grid.getGridItems()) {
      const node = (item as any).gridstackNode;
      const width = Number(node?.w ?? item.getAttribute('gs-w') ?? 100);
      const x = Number(node?.x ?? item.getAttribute('gs-x') ?? 0);
      const height = Number(node?.h ?? item.getAttribute('gs-h') ?? 1);

      devices.push({
        id: Number(item.getAttribute('gs-id') ?? item.dataset.deviceId),
        face,
        y: Number(node?.y ?? item.getAttribute('gs-y') ?? 0),
        position: getPosition(root, gridElement, item),
        offset: x / 100,
        width: width / 100,
        height,
      });
    }
  }

  return { devices };
}

function markChanged(root: HTMLElement): void {
  root.dataset.changed = 'true';
  root.querySelector<HTMLButtonElement>('[data-rack-reorder-save]')?.removeAttribute('disabled');
}

async function save(root: HTMLElement, grids: GridStack[]): Promise<void> {
  const saveButton = root.querySelector<HTMLButtonElement>('[data-rack-reorder-save]');
  saveButton?.setAttribute('disabled', 'disabled');

  const response = await fetch(root.dataset.saveUrl ?? window.location.href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(root),
    },
    body: JSON.stringify(getPayload(root, grids)),
  });

  if (response.ok) {
    root.dataset.changed = 'false';
    window.location.href = root.dataset.returnUrl ?? window.location.href;
    return;
  }

  saveButton?.removeAttribute('disabled');
  const data = await response.json().catch(() => ({ error: 'Unable to save rack order.' }));
  showToast('danger', 'Error', JSON.stringify(data.error ?? data));
}

export function initRackReorder(): void {
  const root = document.querySelector<HTMLElement>('[data-rack-reorder]');
  if (root === null || root.dataset.rackReorderInitialized === 'true') return;
  root.dataset.rackReorderInitialized = 'true';

  const grids: GridStack[] = [];
  const options = {
    cellHeight: 11,
    margin: 0,
    marginBottom: 1,
    float: true,
    disableOneColumnMode: true,
    animate: true,
    removable: false,
    resizable: { handles: 'e,w' },
    acceptWidgets: true,
  };

  for (const gridElement of root.querySelectorAll<HTMLElement>('.rack-reorder-grid')) {
    const grid = GridStack.init(options, gridElement);
    grid.on('change dropped removed added', () => markChanged(root));
    grid.on('dropped', () => {
      for (const item of grid.getGridItems()) {
        item.dataset.face = gridElement.dataset.face ?? 'none';
      }
      markChanged(root);
    });
    grids.push(grid);
  }

  root.querySelector<HTMLButtonElement>('[data-rack-reorder-save]')?.addEventListener('click', () => {
    save(root, grids).catch(error => {
      showToast('danger', 'Error', String(error));
      root.querySelector<HTMLButtonElement>('[data-rack-reorder-save]')?.removeAttribute('disabled');
    });
  });

  window.addEventListener('beforeunload', event => {
    if (root.dataset.changed === 'true') {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
