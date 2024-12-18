import { loadBTTVEmotes, loadEmojiGGEmotes } from '../popup';

describe('Emote Loading', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('loadBTTVEmotes should fetch and format emotes correctly', async () => {
    const mockEmotes = [
      { id: '123', code: 'test1' },
      { id: '456', code: 'test2' }
    ];

    fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEmotes)
      })
    );

    const result = await loadBTTVEmotes();
    
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('url');
    expect(result[0].url).toContain('3x');
    expect(result[0].source).toBe('bttv');
  });

  test('loadEmojiGGEmotes should handle API errors', async () => {
    fetch.mockImplementationOnce(() => 
      Promise.reject(new Error('API Error'))
    );

    const result = await loadEmojiGGEmotes();
    expect(result).toEqual([]);
  });
});
