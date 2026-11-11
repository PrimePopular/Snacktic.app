/** Shares text with the phone's own share sheet, or copies it when sharing is not available. */
export async function shareContent(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = window.location.origin;
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch (error) {
    // Closing the share sheet counts as cancelling, not as an error.
    if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    return 'failed';
  }
}
