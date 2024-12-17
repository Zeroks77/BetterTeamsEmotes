let bttvEmotes = [];
let currentPopup = null;
let overlayContainer = null;

function createOverlayContainer() {
  if (overlayContainer) return overlayContainer;
  
  overlayContainer = document.createElement('div');
  overlayContainer.className = 'bttv-overlay-container';
  document.body.appendChild(overlayContainer);
  return overlayContainer;
}

// Remove createFloatingButton and injectButtons functions

function createEmotePopup() {
  const popup = document.createElement('div');
  popup.className = 'bttv-popup';
  
  // Create DOM elements without using innerHTML
  const header = document.createElement('div');
  header.className = 'bttv-popup-header';
  
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'bttv-search';
  search.placeholder = 'Search emotes...';
  
  const close = document.createElement('button');
  close.className = 'bttv-close';
  close.textContent = '×';
  close.addEventListener('click', toggleEmotePopup);
  
  const grid = document.createElement('div');
  grid.className = 'bttv-emote-grid';
  
  header.appendChild(search);
  header.appendChild(close);
  popup.appendChild(header);
  popup.appendChild(grid);

  bttvEmotes.forEach(emote => {
    const emoteEl = document.createElement('div');
    emoteEl.className = 'bttv-emote';
    const img = document.createElement('img');
    img.src = emote.url;
    img.title = emote.code;
    img.alt = emote.code;
    img.height = 28;
    emoteEl.appendChild(img);
    emoteEl.addEventListener('click', () => {
      insertEmote(emote).catch(console.error);
    });
    grid.appendChild(emoteEl);
  });

  search.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    grid.querySelectorAll('.bttv-emote').forEach(el => {
      el.style.display = el.querySelector('img').alt.toLowerCase().includes(query) ? '' : 'none';
    });
  });

  return popup;
}

function toggleEmotePopup() {
  if (currentPopup?.isConnected) {
    currentPopup.remove();
    currentPopup = null;
    return;
  }

  currentPopup = createEmotePopup();
  document.body.appendChild(currentPopup);
}

// Remove position-related code from insertEmote
function insertEmote(emote) {
  try {
    // Create clipboard item from emote
    const img = document.createElement('img');
    img.src = emote.url;
    document.body.appendChild(img);
    const range = document.createRange();
    range.selectNode(img);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    document.body.removeChild(img);
    
    toggleEmotePopup();
  } catch (error) {
    console.error('Failed to insert emote:', error);
  }
}

// Initialize
chrome.runtime.sendMessage({action: 'getEmotes'}, response => {
  if (response?.emotes) {
    bttvEmotes = response.emotes;
  }
});

// Keep click outside handler
document.addEventListener('click', (e) => {
  if (currentPopup && !currentPopup.contains(e.target)) {
    currentPopup.remove();
    currentPopup = null;
  }
});
