let allEmotes = [];

async function fetchBTTVEmotes() {
  try {
    const response = await fetch('https://api.betterttv.net/3/cached/emotes/global');
    if (!response.ok) throw new Error(`BTTV HTTP error: ${response.status}`);
    const emotes = await response.json();
    return emotes.map(emote => ({
      id: emote.id,
      code: emote.code,
      url: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
      source: 'bttv'
    }));
  } catch (error) {
    console.error('BTTV fetch error:', error);
    return [];
  }
}

async function fetchEmojiGGEmotes() {
  try {
    // Try multiple endpoints for emoji.gg
    const endpoints = [
      'https://emoji.gg/api',
      'https://emoji.gg/api/all-emojis',
      'https://emoji.gg/api/popular'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) continue;
        
        const data = await response.json();
        const emotes = Array.isArray(data) ? data : (data.emojis || []);
        
        if (emotes.length > 0) {
          console.log('EmojiGG emotes loaded:', emotes.length);
          return emotes.map(emote => ({
            id: emote.id || emote.slug,
            code: emote.title || emote.name,
            url: emote.image || emote.url,
            source: 'emojigg'
          }));
        }
      } catch (e) {
        console.warn(`Failed to fetch from ${endpoint}:`, e);
      }
    }
    throw new Error('All emoji.gg endpoints failed');
  } catch (error) {
    console.error('EmojiGG fetch error:', error);
    return [];
  }
}

async function fetchAllEmotes() {
  try {
    const [bttvEmotes, emojiggEmotes] = await Promise.all([
      fetchBTTVEmotes(),
      fetchEmojiGGEmotes()
    ]);

    allEmotes = [...bttvEmotes, ...emojiggEmotes].filter(emote => 
      emote.id && emote.code && emote.url
    );

    if (allEmotes.length > 0) {
      await chrome.storage.local.set({ cachedEmotes: allEmotes });
      console.log('Cached', allEmotes.length, 'emotes');
    }
    
    return allEmotes;
  } catch (error) {
    console.error('Error fetching all emotes:', error);
    return [];
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getEmotes') {
    console.log('Received getEmotes request');
    chrome.storage.local.get('cachedEmotes', async (result) => {
      if (result.cachedEmotes?.length > 0) {
        console.log(`Returning ${result.cachedEmotes.length} cached emotes`);
        sendResponse({ emotes: result.cachedEmotes });
      } else {
        console.log('No cached emotes, fetching fresh ones...');
        const emotes = await fetchAllEmotes();
        console.log(`Fetched ${emotes.length} fresh emotes`);
        sendResponse({ emotes });
      }
    });
    return true;
  }
});

// Update initial fetch
console.log('Background script initialized');
fetchAllEmotes().then(emotes => {
  console.log(`Initially loaded ${emotes.length} emotes`);
}).catch(error => {
  console.error('Initial fetch failed:', error);
});
