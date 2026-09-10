import { describe, expect, it } from 'vitest';
import { GET } from './route';

const ctx = (tokenId: string) => ({
  params: Promise.resolve({ tokenId }),
});

describe('/api/media/token/[tokenId]', () => {
  it('renders an "Image pending" SVG when state=unverified and labels the data gap', async () => {
    const request = new Request('https://app.test/api/media/token/43866?state=unverified');
    const response = await GET(request, ctx('43866'));
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    const body = await response.text();
    expect(body).toContain('Image pending');
    expect(body).toContain('43866');
    // Must not fabricate a trait caption.
    expect(body).not.toContain('5 Digit');
    expect(body).not.toContain('Palindrome');
  });

  it('keeps the trait-aware SVG by default for tokens that were verified', async () => {
    const request = new Request('https://app.test/api/media/token/43866');
    const response = await GET(request, ctx('43866'));
    const body = await response.text();
    expect(body).toContain('BUTTON PRESSER');
    // The trait caption is computed from classifyNumber; a 5-digit number
    // should fall back to its class label rather than "Image unavailable".
    expect(body).not.toContain('Image pending');
  });

  it('renders "Image unavailable" when state=missing and the token is verified but has no image', async () => {
    const request = new Request('https://app.test/api/media/token/43866?state=missing');
    const response = await GET(request, ctx('43866'));
    const body = await response.text();
    expect(body).toContain('BUTTON PRESSER');
    // "missing" is the verified-but-no-image variant.
    expect(body).not.toContain('Image pending');
  });

  it('escapes malicious tokenId input', async () => {
    const request = new Request('https://app.test/api/media/token/%3Cscript%3E?state=unverified');
    const response = await GET(request, ctx('<script>'));
    const body = await response.text();
    expect(body).not.toContain('<script>');
    expect(body).toContain('&lt;script&gt;');
  });
});