import { createIcons, icons } from 'lucide';

const EMOJI_ICON_MAP = new Map([
  ['👨‍🏫', 'graduation-cap'], ['🧪', 'flask-conical'], ['🪪', 'id-card'],
  ['📊', 'chart-no-axes-column-increasing'], ['👥', 'users'], ['📑', 'files'],
  ['📋', 'clipboard-list'], ['🗂️', 'folder-kanban'], ['⏰', 'clock-3'],
  ['⚙️', 'settings-2'], ['📷', 'scan-line'], ['🔐', 'lock-keyhole'],
  ['🚪', 'log-out'], ['📡', 'scan-line'], ['📝', 'file-pen-line'],
  ['🔄', 'refresh-cw'], ['📥', 'file-input'], ['📤', 'file-output'],
  ['➕', 'plus'], ['➖', 'minus'], ['🗑️', 'trash-2'], ['🗑', 'trash-2'],
  ['👁️', 'eye'], ['👁', 'eye'], ['🔍', 'search'], ['🔗', 'link-2'],
  ['🖨️', 'printer'], ['🖨', 'printer'], ['💾', 'save'], ['📁', 'folder'],
  ['📂', 'folder-open'], ['📄', 'file-text'], ['📅', 'calendar-days'],
  ['📱', 'smartphone'], ['🏫', 'school'], ['🏛️', 'landmark'], ['🏛', 'landmark'],
  ['🏠', 'house'], ['🏥', 'hospital'], ['🎓', 'graduation-cap'], ['🎒', 'backpack'],
  ['💼', 'briefcase-business'], ['💡', 'lightbulb'], ['🔔', 'bell'], ['🔘', 'circle-dot'],
  ['🔴', 'circle'], ['🕌', 'landmark'], ['🚀', 'rocket'], ['🛡️', 'shield-check'],
  ['🛡', 'shield-check'], ['🧭', 'compass'], ['🌅', 'sunrise'], ['🌇', 'sunset'],
  ['🌙', 'moon'], ['🎉', 'party-popper'], ['➡️', 'arrow-right'], ['⬅️', 'arrow-left'],
  ['↩️', 'undo-2'], ['⚡', 'zap'], ['☑️', 'square-check-big'], ['✕', 'x'], ['✓', 'check']
]);

const emojiPattern = new RegExp(
  Array.from(EMOJI_ICON_MAP.keys())
    .sort((first, second) => second.length - first.length)
    .map((emoji) => emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g'
);

const UI_ICON_SELECTOR = [
  'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.nav-icon', '.badge',
  '.status-tag', '.toast-msg', '.modal-header', '.kiosk-guide-tip',
  '.scanner-title', '.quick-scanner-title', '.session-badge-banner',
  '.folder-icon-wrapper', '.card-actions-quick', '.schedule-page-icon',
  '.timeline-milestone-card', '#admin-cms-layout span', '#public-kiosk-layout span'
].join(', ');

function shouldIconifyText(node) {
  const parent = node.parentElement;
  if (!parent || !node.nodeValue || !emojiPattern.test(node.nodeValue)) return false;

  emojiPattern.lastIndex = 0;
  if (parent.closest('script, style, textarea, input, select, option, code, pre, .student-card-portrait')) return false;
  if (parent.closest('td') && !parent.closest('button')) return false;

  return Boolean(parent.closest(UI_ICON_SELECTOR));
}

function replaceEmojiText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let currentNode;

  while ((currentNode = walker.nextNode())) {
    if (shouldIconifyText(currentNode)) textNodes.push(currentNode);
  }

  textNodes.forEach((node) => {
    const fragment = document.createDocumentFragment();
    let offset = 0;

    node.nodeValue.replace(emojiPattern, (emoji, index) => {
      if (index > offset) fragment.append(document.createTextNode(node.nodeValue.slice(offset, index)));

      const icon = document.createElement('i');
      icon.className = 'app-lucide-icon';
      icon.dataset.lucide = EMOJI_ICON_MAP.get(emoji);
      icon.setAttribute('aria-hidden', 'true');
      fragment.append(icon);
      offset = index + emoji.length;
      return emoji;
    });

    if (offset < node.nodeValue.length) fragment.append(document.createTextNode(node.nodeValue.slice(offset)));
    node.replaceWith(fragment);
  });
}

export function refreshIcons(root = document.body) {
  replaceEmojiText(root);
  createIcons({
    icons,
    attrs: {
      'aria-hidden': 'true',
      'stroke-width': 1.9
    }
  });
}

export function initIcons() {
  refreshIcons();

  const observer = new MutationObserver((mutations) => {
    const hasNewContent = mutations.some((mutation) => mutation.addedNodes.length > 0);
    if (hasNewContent) window.requestAnimationFrame(() => refreshIcons());
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
