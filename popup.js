let bttvEmotes = [];
let currentSource = 'all';

// Add shared channel definitions
const TOP_CHANNELS = [
  { username: 'xqc', id: '71092938' },
  { username: 'summit1g', id: '26490481' },
  { username: 'sodapoppin', id: '26301881' },
  { username: 'shroud', id: '37402112' },
  { username: 'forsen', id: '22484632' },
  { username: 'hasanabi', id: '207813352' },
  { username: 'moistcr1tikal', id: '132230344' },
  { username: 'asmongold', id: '26261471' },
  { username: 'lirik', id: '23161357' },
  { username: 'Zeroks77', id: '67349329' },
  { username: 'Gorgc', id: '108268890' },
  { username: 'AdmiralBulldog', id: '30816637' },
  { username: 'piratesoftware', id: '151368796' },
  { username: 'yapzordota', id: '77697536' }
];

// Update the CDN domains to use correct endpoints
const EMOJI_CDN_DOMAINS = [
  'cdn3.emoji.gg',      // Primary source
  'cdn2.emoji.gg',      // Fallback 1
  'cdn1.emoji.gg'       // Fallback 2
];

async function tryFetchWithFallbacks(url) {
  // Extract filename from URL
  const filename = url.split('/').pop();
  
  // Try each CDN domain
  for (const domain of EMOJI_CDN_DOMAINS) {
    try {
      const modifiedUrl = `https://${domain}/emojis/${filename}`;
      console.log('Trying URL:', modifiedUrl);
      
      const response = await fetch(modifiedUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'force-cache',
        headers: {
          'Accept': 'image/*, */*'
        }
      });
      
      if (response.ok) {
        console.log(`Successfully loaded from ${domain}`);
        return response;
      }
    } catch (error) {
      console.warn(`Failed to load from ${domain}:`, error);
    }
  }

  // Try direct URL as last resort
  try {
    const directUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log('Trying direct URL:', directUrl);
    const response = await fetch(directUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'force-cache'
    });
    console.log('Loaded with direct URL');
    return response;
  } catch (error) {
    console.error('All fetch attempts failed:', error);
    throw new Error('All CDN fallbacks failed');
  }
}

async function loadBTTVEmotes() {
  try {
    // Fetch global and trending emotes
    const baseEndpoints = [
      'https://api.betterttv.net/3/cached/emotes/global',
      'https://api.betterttv.net/3/cached/trending/emotes'
    ];

    // Fetch channel emotes directly using channel IDs
    const channelEmotesPromises = TOP_CHANNELS.map(async channel => {
      try {
        // Using the direct channel emotes endpoint
        const response = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channel.id}`);
        if (response.ok) {
          const data = await response.json();
          // Combine channel and shared emotes
          return {
            data: [
              ...(data.channelEmotes || []).map(e => ({ ...e, source: `bttv-channel-${channel.username}` })),
              ...(data.sharedEmotes || []).map(e => ({ ...e, source: `bttv-shared-${channel.username}` }))
            ],
            source: `bttv-channel-${channel.username}`
          };
        } else {
          console.warn(`Failed to fetch emotes for ${channel.username}: ${response.status}`);
        }
      } catch (error) {
        console.warn(`Error fetching emotes for ${channel.username}:`, error);
      }
      return null;
    });

    // Fetch base emotes and channel emotes in parallel
    const [baseResponses, channelResponses] = await Promise.all([
      Promise.allSettled(baseEndpoints.map(url => fetch(url))),
      Promise.allSettled(channelEmotesPromises)
    ]);

    const results = [];
    
    // Process base endpoints
    for (const [index, response] of baseResponses.entries()) {
      if (response.status === 'fulfilled' && response.value.ok) {
        const data = await response.value.json();
        results.push({
          data: Array.isArray(data) ? data : [],
          source: baseEndpoints[index].includes('global') ? 'bttv-global' : 'bttv-trending'
        });
      }
    }

    // Process channel responses
    channelResponses.forEach(response => {
      if (response.status === 'fulfilled' && response.value) {
        results.push(response.value);
      }
    });

    // Log responses
    console.log('BTTV API Responses:', results.map(r => ({
      source: r.source,
      count: r.data.length
    })));

    // Combine all emotes with source tags
    const allBTTVEmotes = results.flatMap(result => 
      result.data.map(e => ({ ...e, source: result.source }))
    );

    // Remove duplicates by ID
    const uniqueEmotes = Array.from(
      new Map(allBTTVEmotes.map(item => [item.id, item])).values()
    );

    console.log('Total unique BTTV emotes:', uniqueEmotes.length);

    return uniqueEmotes.map(emote => ({
      id: emote.id,
      code: emote.code || `Emote_${emote.id}`,
      url: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
      source: emote.source
    }));
  } catch (error) {
    console.error('BTTV Error:', error);
    return [];
  }
}

async function loadEmojiGGEmotes(searchQuery = '') {
  try {
    let allEmotes = [];
    
    // Define category URLs to scrape with correct format
    const categoryUrls = [
      'https://emoji.gg/category/13/pepe?sort=downloads',    // Pepe emotes
      'https://emoji.gg/category/8/anime?sort=downloads',    // Anime emotes
      'https://emoji.gg/category/3/memes?sort=downloads',    // Meme emotes
      'https://emoji.gg/emojis?sort=downloads&page=1'       // All emotes (fallback)
    ];

    // Try scraping each category
    for (const url of categoryUrls) {
      try {
        console.log(`Scraping category: ${url}`);
        const response = await fetch(url);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Updated selectors to match current emoji.gg structure
        const emoteCards = Array.from(doc.querySelectorAll('.emoji-card, [class*="emojiCard"]'));
        console.log(`Found ${emoteCards.length} emote cards in ${url}`);

        const categoryEmotes = emoteCards
          .slice(0, 500) // Limit to 500 emotes per category
          .map(card => {
            // Updated selectors for image and title
            const img = card.querySelector('img, [class*="emojiImage"]');
            const title = card.querySelector('[class*="emojiName"], [class*="title"], .name') || img;
            const id = card.getAttribute('data-id') || card.getAttribute('id') || 
                      img?.src?.match(/\/(\d+)_/)?.[1];
            
            if (!img?.src) {
              console.log('Skipping card without image:', card);
              return null;
            }

            // Extract clean image URL
            const imageUrl = new URL(img.src);
            const filename = imageUrl.pathname.split('/').pop();
            
            // Extract category from URL
            const categoryMatch = url.match(/category\/(\d+)/);
            const category = categoryMatch ? `category-${categoryMatch[1]}` : 'general';
            
            const emote = {
              id: id || Math.random().toString(36).substr(2),
              code: title?.textContent?.trim() || title?.getAttribute('alt') || `Emoji_${id}`,
              url: `https://${EMOJI_CDN_DOMAINS[0]}/emojis/${filename}`,
              source: `emojigg-${category}`,
              originalUrl: img.src
            };

            console.log('Parsed emote:', emote);
            return emote;
          })
          .filter(Boolean);

        console.log(`Successfully parsed ${categoryEmotes.length} emotes from ${url}`);
        console.log('Sample emotes:', categoryEmotes.slice(0, 3));
        
        allEmotes.push(...categoryEmotes);
      } catch (error) {
        console.warn(`Failed to scrape ${url}:`, error);
      }
    }

    // If we have scraped emotes and no specific search query, return all
    if (allEmotes.length > 0) {
      console.log('Total unique emotes scraped:', allEmotes.length);
      console.log('Emotes by category:', Object.groupBy(allEmotes, e => e.source));
      
      // Filter by search if needed
      if (searchQuery) {
        const normalizedQuery = searchQuery.toLowerCase();
        allEmotes = allEmotes.filter(emote => 
          emote.code.toLowerCase().includes(normalizedQuery)
        );
        console.log(`Search "${searchQuery}" found ${allEmotes.length} matches`);
      }
      
      return allEmotes;
    }

    // Fall back to API if scraping fails
    // Try multiple API endpoints in order
    const endpoints = [
      'https://emoji.gg/api',
      'https://discordemoji.com/api/v1/emojis',
      'https://discordemoji.com/api/v1/packs'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          console.warn(`Endpoint ${endpoint} failed with ${response.status}`);
          continue;
        }

        const data = await response.json();
        let emotes = [];

        // Handle different API response formats
        if (Array.isArray(data)) {
          emotes = data;
        } else if (data.emojis) {
          emotes = data.emojis;
        } else if (data.packs) {
          emotes = data.packs.flatMap(pack => pack.emojis || []);
        }

        if (emotes.length === 0) {
          console.warn(`No emotes found in ${endpoint}`);
          continue;
        }

        console.log(`Successfully loaded ${emotes.length} emotes from ${endpoint}`);

        // Filter by search query if provided
        if (searchQuery) {
          const normalizedQuery = searchQuery.toLowerCase();
          emotes = emotes.filter(emote => 
            (emote.title || emote.name || '')?.toLowerCase().includes(normalizedQuery)
          );
        }

        return emotes
          .filter(emote => emote.image || emote.url)
          .map(emote => {
            const imageUrl = emote.image || emote.url;
            // Extract just the filename without query parameters
            const filename = imageUrl.split('/').pop().split('?')[0];
            
            return {
              id: emote.id || emote.slug || Math.random().toString(36).substr(2),
              code: emote.title || emote.name,
              url: `https://${EMOJI_CDN_DOMAINS[0]}/emojis/${filename}`,
              fallbackUrls: EMOJI_CDN_DOMAINS.slice(1).map(domain => 
                `https://${domain}/emojis/${filename}`
              ),
              originalUrl: imageUrl,
              source: 'emojigg'
            };
          });
      } catch (error) {
        console.warn(`Failed to fetch from ${endpoint}:`, error);
      }
    }

    console.error('All emoji.gg endpoints failed');
    return [];
  } catch (error) {
    console.error('EmojiGG Error:', error);
    return [];
  }
}

async function loadFFZEmotes() {
  try {
    const endpoints = [
      'https://api.frankerfacez.com/v1/emoticons/top?sort=count-desc&per_page=200&page=1',
      'https://api.frankerfacez.com/v1/emoticons/top?sort=count-desc&per_page=200&page=2',
      'https://api.frankerfacez.com/v1/set/global',
      // Top channels' FFZ emotes
      ...TOP_CHANNELS.map(channel => 
        `https://api.frankerfacez.com/v1/room/id/${channel.id}`
      )
    ];

    const responses = await Promise.allSettled(
      endpoints.map(url => fetch(url))
    );

    const results = [];
    
    // Process responses
    for (const response of responses) {
      if (response.status === 'fulfilled' && response.value.ok) {
        const data = await response.value.json();
        
        if (data.sets) {
          // Process sets (global or room emotes)
          Object.values(data.sets).forEach(set => {
            if (set.emoticons) {
              results.push(...set.emoticons.map(emote => ({
                ...emote,
                source: `ffz-${set.title || 'global'}`
              })));
            }
          });
        } else if (data.emoticons) {
          // Process top emotes
          results.push(...data.emoticons.map(emote => ({
            ...emote,
            source: 'ffz-top'
          })));
        }
      }
    }

    console.log('FFZ Emotes loaded:', results.length);

    // Transform emotes to our format
    return results.map(emote => {
      // Get highest resolution available
      const urls = emote.urls || {};
      const highestRes = Math.max(...Object.keys(urls).map(Number));
      const url = urls[highestRes] || urls['1'];

      return {
        id: emote.id,
        code: emote.name,
        url: url.startsWith('//') ? `https:${url}` : url,
        source: emote.source,
        owner: emote.owner?.name
      };
    });
  } catch (error) {
    console.error('FFZ Error:', error);
    return [];
  }
}

async function load7TVEmotes() {
  try {
    // Define API endpoints
    const endpoints = [
      'https://7tv.io/v3/gql',  // GraphQL API endpoint
      'https://api.7tv.app/v2/emotes/global',  // Legacy API fallback
    ];

    const gqlQuery = {
      operationName: 'SearchEmotes',
      query: `
        query SearchEmotes($query: String!, $page: Int, $limit: Int) {
          emotes(query: $query, page: $page, limit: $limit) {
            items {
              id name owner {name} urls host {url}
            }
          }
        }
      `,
      variables: {
        query: '',  // Empty for all emotes
        page: 0,
        limit: 150  // Fetch top emotes
      }
    };

    const results = [];

    // Try GraphQL endpoint first
    try {
      const response = await fetch(endpoints[0], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gqlQuery)
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.data?.emotes?.items) {
          results.push(...data.data.emotes.items);
        }
      }
    } catch (error) {
      console.warn('7TV GraphQL API failed:', error);
    }

    // Try legacy API if needed
    if (results.length === 0) {
      try {
        const response = await fetch(endpoints[1]);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            results.push(...data);
          }
        }
      } catch (error) {
        console.warn('7TV Legacy API failed:', error);
      }
    }

    console.log('7TV Emotes loaded:', results.length);

    // Transform emotes to our format
    return results
      .filter(emote => emote.urls?.[3] || emote.urls?.[2] || emote.urls?.[1])
      .map(emote => ({
        id: emote.id,
        code: emote.name,
        url: emote.urls?.[3] || emote.urls?.[2] || emote.urls?.[1], // Get highest quality
        source: '7tv',
        owner: emote.owner?.name
      }));
  } catch (error) {
    console.error('7TV Error:', error);
    return [];
  }
}

async function copyEmote(emote) {
  try {
    let response;
    if (emote.source === 'emojigg') {
      response = await tryFetchWithFallbacks(emote.url);
      
      if (!response.ok) {
        // Try fallback URLs
        for (const fallbackUrl of [...emote.fallbackUrls, emote.originalUrl]) {
          try {
            response = await fetch(fallbackUrl);
            if (response.ok) break;
          } catch (error) {
            console.warn(`Fallback failed for ${fallbackUrl}:`, error);
          }
        }
      }
    } else {
      response = await fetch(emote.url);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch emote: ${response.status}`);
    }
    
    // Create an img element to get the image data
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    
    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = emote.url;
    });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Determine image type and handle conversion
    const isWebP = emote.url.toLowerCase().endsWith('.webp');
    const isGif = emote.url.toLowerCase().endsWith('.gif');
    
    let mimeType = 'image/png';
    if (isGif) mimeType = 'image/gif';
    
    // Convert WebP to PNG for better compatibility
    let blob;
    if (isWebP) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      console.log('Converted WebP to PNG');
    } else {
      // For GIFs and PNGs, fetch directly to preserve animation
      const response = await fetch(emote.url);
      blob = await response.blob();
    }
    
    // Copy to clipboard
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      showNotice(`Emote copied! (${isWebP ? 'PNG' : (isGif ? 'GIF' : 'PNG')})`, true);
    } catch (clipboardError) {
      // Fallback method
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

// Add cache management
const CACHE_VERSION = 1;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Update cache management with better error handling
async function getCachedEmotes() {
  try {
    const cache = await chrome.storage.local.get(['emotes', 'cacheTimestamp', 'cacheVersion']);
    if (!cache) return null;

    const isExpired = !cache.cacheTimestamp || Date.now() - cache.cacheTimestamp > CACHE_DURATION;
    const isOutdated = cache.cacheVersion !== CACHE_VERSION;
    
    if (isExpired || isOutdated || !cache.emotes?.length) {
      console.log('Cache is expired or outdated, fetching fresh data');
      return null;
    }

    console.log(`Found ${cache.emotes.length} cached emotes`);
    return cache.emotes;
  } catch (error) {
    console.warn('Failed to get cached emotes:', error);
    return null;
  }
}

async function setCachedEmotes(emotes) {
  try {
    await chrome.storage.local.set({
      emotes,
      cacheTimestamp: Date.now(),
      cacheVersion: CACHE_VERSION
    });
    console.log(`Cached ${emotes.length} emotes`);
  } catch (error) {
    console.warn('Failed to cache emotes:', error);
  }
}

// Add virtual scrolling
function renderEmotes(emotes) {
  console.log('renderEmotes called with', emotes?.length, 'emotes');
  const grid = document.querySelector('.emote-grid');
  
  if (!emotes || emotes.length === 0) {
    grid.innerHTML = '<div class="bttv-loading">No emotes found</div>';
    return;
  }

  // Clear existing content
  grid.innerHTML = '<div class="virtual-scroll"></div>';
  const virtualScroll = grid.querySelector('.virtual-scroll');
  
  // Calculate dimensions
  const itemHeight = 32;
  const itemsPerRow = 10;
  const rowHeight = itemHeight;
  const totalRows = Math.ceil(emotes.length / itemsPerRow);
  
  // Update height of virtual scroll container
  virtualScroll.style.minHeight = `${totalRows * rowHeight}px`;
  
  // Create observer for lazy loading
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    },
    { rootMargin: '50px' }
  );

  // Render visible items
  function renderVisibleItems() {
    const scrollTop = grid.scrollTop;
    const viewportHeight = grid.clientHeight;
    
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.ceil((scrollTop + viewportHeight) / rowHeight);
    
    const startIndex = startRow * itemsPerRow;
    const endIndex = Math.min(endRow * itemsPerRow, emotes.length);
    
    // Remove items that are no longer visible
    const existingItems = virtualScroll.children;
    Array.from(existingItems).forEach(item => {
      const index = parseInt(item.dataset.index);
      if (index < startIndex || index >= endIndex) {
        item.remove();
      }
    });
    
    // Add new visible items
    for (let i = startIndex; i < endIndex; i++) {
      if (!virtualScroll.querySelector(`[data-index="${i}"]`)) {
        const emote = emotes[i];
        const emoteEl = document.createElement('div');
        emoteEl.className = 'emote';
        emoteEl.dataset.index = i;
        emoteEl.style.position = 'absolute';
        emoteEl.style.top = `${Math.floor(i / itemsPerRow) * rowHeight}px`;
        emoteEl.style.left = `${(i % itemsPerRow) * (100 / itemsPerRow)}%`;
        emoteEl.style.width = `${100 / itemsPerRow}%`;
        
        const img = document.createElement('img');
        img.dataset.src = emote.url; // Lazy load
        img.title = emote.code;
        img.alt = emote.code;
        img.height = 28;
        
        observer.observe(img);
        emoteEl.appendChild(img);
        emoteEl.onclick = () => copyEmote(emote);
        virtualScroll.appendChild(emoteEl);
      }
    }
  }

  // Add scroll listener
  const debouncedRender = debounce(renderVisibleItems, 16); // ~60fps
  grid.addEventListener('scroll', debouncedRender);
  
  // Initial render
  renderVisibleItems();
}

// Optimize search with worker
const searchWorker = new Worker(URL.createObjectURL(new Blob([`
  self.onmessage = function(e) {
    const { emotes, query } = e.data;
    const results = emotes
      .map(emote => ({
        ...emote,
        score: getMatchScore(emote.code, query)
      }))
      .filter(emote => emote.score > 0)
      .sort((a, b) => b.score - a.score);
    
    self.postMessage(results);
  };

  ${getMatchScore.toString()}
  ${normalizeString.toString()}
  ${fuzzyMatch.toString()}
`], { type: 'text/javascript' })));

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loading emotes...');
  try {
    // Try to load from cache first
    let cachedEmotes = await getCachedEmotes();
    
    if (!cachedEmotes) {
      const [bttvData, emojiggData, ffzData, sevenTVData] = await Promise.all([
        loadBTTVEmotes(),
        loadEmojiGGEmotes(),
        loadFFZEmotes(),
        load7TVEmotes()
      ]);
      
      bttvEmotes = [...bttvData, ...emojiggData, ...ffzData, ...sevenTVData];
      await setCachedEmotes(bttvEmotes);
    } else {
      bttvEmotes = cachedEmotes;
    }
    
    console.log('Total emotes loaded:', bttvEmotes.length);
    
    if (bttvEmotes.length > 0) {
      renderEmotes(bttvEmotes);
      
      // Add search handler
      document.querySelector('.search-box').addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        
        if (!query) {
          renderEmotes(bttvEmotes);
          return;
        }
        
        // First search local BTTV emotes
        const bttvMatches = bttvEmotes
          .filter(emote => emote.source.startsWith('bttv'))
          .map(emote => ({
            ...emote,
            score: getMatchScore(emote.code, query)
          }))
          .filter(emote => emote.score > 0)
          .sort((a, b) => b.score - a.score);
        
        // Then fetch emoji.gg results
        const emojiggResults = await loadEmojiGGEmotes(query);
        
        // Combine results
        const combinedResults = [...bttvMatches, ...emojiggResults];
        console.log(`Search "${query}" found ${combinedResults.length} matches`);
        renderEmotes(combinedResults);
      }, 500));
    } else {
      document.querySelector('.emote-grid').innerHTML = 'Failed to load emotes :(';
    }
  } catch (error) {
    console.error('Failed to load emotes:', error);
    document.querySelector('.emote-grid').innerHTML = 'Failed to load emotes :(';
  }
});

// Add debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showNotice(message, success) {
  const notice = document.querySelector('.copy-notice');
  notice.textContent = message;
  notice.style.backgroundColor = success ? '#4CAF50' : '#f44336';
  notice.style.display = 'block';
  setTimeout(() => notice.style.display = 'none', 1500);
}

function normalizeString(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function fuzzyMatch(str, pattern) {
  str = normalizeString(str);
  pattern = normalizeString(pattern);
  
  let patternIdx = 0;
  let strIdx = 0;
  
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      patternIdx++;
    }
    strIdx++;
  }
  
  return patternIdx === pattern.length;
}

function getMatchScore(emoteCode, query) {
  const normalizedEmote = normalizeString(emoteCode);
  const normalizedQuery = normalizeString(query);
  
  // Exact match gets highest score
  if (normalizedEmote === normalizedQuery) return 100;
  
  // Starting with query gets high score
  if (normalizedEmote.startsWith(normalizedQuery)) return 80;
  
  // Contains full query gets medium score
  if (normalizedEmote.includes(normalizedQuery)) return 60;
  
  // Word boundary match gets medium-low score
  const words = normalizedEmote.split(/[^a-z0-9]+/);
  if (words.some(word => word.startsWith(normalizedQuery))) return 40;
  
  // Fuzzy match gets low score
  if (fuzzyMatch(normalizedEmote, normalizedQuery)) {
    // Calculate similarity ratio
    let matchCount = 0;
    let lastMatchIndex = -1;
    for (let i = 0; i < normalizedQuery.length; i++) {
      const index = normalizedEmote.indexOf(normalizedQuery[i], lastMatchIndex + 1);
      if (index > -1) {
        matchCount++;
        lastMatchIndex = index;
      }
    }
    const fuzzyScore = (matchCount / normalizedQuery.length) * 30;
    return fuzzyScore;
  }
  
  return 0;
}
