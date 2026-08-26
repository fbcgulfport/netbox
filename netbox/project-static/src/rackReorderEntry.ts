import { initRackReorder } from './rackReorder';

if (document.readyState !== 'loading') {
  initRackReorder();
} else {
  document.addEventListener('DOMContentLoaded', initRackReorder);
}
