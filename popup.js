let bttvEmotes = [];
let currentSource = 'all';

async function loadBTTVEmotes() {
  try {
    const response = await fetch('https://api.betterttv.net/3/cached/emotes/global');
    console.log('BTTV Response:', response.status);
    const data = await response.json();
    console.log('BTTV Data:', data.length, 'emotes');
    return data.map(emote => ({
      id: emote.id,
      code: emote.code,
      url: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
      source: 'bttv'
    }));
  } catch (error) {
    console.error('BTTV Error:', error);
    return [];
  }
}

async function loadEmojiGGEmotes() {
  try {
    const response = await fetch('https://emoji.gg/api/');
    console.log('EmojiGG Response:', response.status);
    const data = await response.json();
    console.log('EmojiGG Data:', data.length, 'emotes');
    return data.map(emote => ({
      id: emote.id,
      code: emote.title,
      url: emote.image,
      source: 'emojigg'
    }));
  } catch (error) {
    console.error('EmojiGG Error:', error);
    return [];
  }
}

async function copyEmote(emote) {
  try {
    // Create an img element to get the image data
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous'; // Enable CORS
    
    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = emote.url;
    });
    
    // Create canvas to handle the image
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    // Draw image to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Get image as blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });
    
    // Copy to clipboard
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
      showNotice('Emote copied!', true);
    } catch (clipboardError) {
      // Fallback: try to copy element directly
      document.body.appendChild(img);
      const range = document.createRange();
      range.selectNode(img);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const success = document.execCommand('copy');
      document.body.removeChild(img);
      
      if (success) {
        showNotice('Emote copied! (fallback)', true);
      } else {
        throw new Error('Fallback copy failed');
      }
    }
  } catch (error) {
    console.error('Copy failed:', error);
    showNotice('Failed to copy emote', false);
  }
}

// Update renderEmotes to handle source filtering
function renderEmotes(emotes) {
  console.log('renderEmotes called with', emotes?.length, 'emotes');
  const grid = document.querySelector('.emote-grid');
  
  if (!emotes || emotes.length === 0) {
    console.warn('No emotes to render');
    grid.innerHTML = '<div class="bttv-loading">Loading emotes... If nothing appears, try refreshing.</div>';
    return;
  }

  grid.innerHTML = '';
  const filteredEmotes = currentSource === 'all' 
    ? emotes 
    : emotes.filter(emote => emote.source === currentSource);
  
  if (filteredEmotes.length === 0) {
    grid.innerHTML = '<div class="bttv-loading">No emotes found for this source</div>';
    return;
  }

  filteredEmotes.forEach(emote => {
    const emoteEl = document.createElement('div');
    emoteEl.className = 'emote';
    const img = document.createElement('img');
    img.src = emote.url;
    img.title = emote.code;
    img.alt = emote.code;
    img.height = 28;
    
    const badge = document.createElement('span');
    badge.className = 'source-badge';
    badge.textContent = emote.source;
    
    emoteEl.appendChild(img);
    emoteEl.appendChild(badge);
    emoteEl.onclick = () => copyEmote(emote);
    grid.appendChild(emoteEl);
  });
}

function showNotice(message, success) {
  const notice = document.querySelector('.copy-notice');
  notice.textContent = message;
  notice.style.backgroundColor = success ? '#4CAF50' : '#f44336';
  notice.style.display = 'block';
  setTimeout(() => notice.style.display = 'none', 1500);
}

// Add single initialization point
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loading emotes...');
  try {
    const [bttvData, emojiggData] = await Promise.all([
      loadBTTVEmotes(),
      loadEmojiGGEmotes()
    ]);
    
    bttvEmotes = [...bttvData, ...emojiggData];
    console.log('Total emotes loaded:', bttvEmotes.length);
    
    if (bttvEmotes.length > 0) {
      renderEmotes(bttvEmotes);
      
      // Add search handler
      document.querySelector('.search-box').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = bttvEmotes.filter(emote => 
          emote.code.toLowerCase().includes(query)
        );
        renderEmotes(filtered);
      });
      
      // Add source tab handling
      document.querySelectorAll('.source-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
          e.target.classList.add('active');
          currentSource = e.target.dataset.source;
          renderEmotes(bttvEmotes);
        });
      });
    } else {
      document.querySelector('.emote-grid').innerHTML = 'Failed to load emotes :(';
    }
  } catch (error) {
    console.error('Failed to load emotes:', error);
    document.querySelector('.emote-grid').innerHTML = 'Failed to load emotes :(';
  }
});
