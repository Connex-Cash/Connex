// fetch with a timeout and a hard cap on how much of the response is read.
export async function fetchCapped(url, init = {}, { timeoutMs = 20_000, maxBytes = 2_000_000 } = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const reader = res.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`response over ${maxBytes} bytes from ${new URL(url).host}`);
      }
      chunks.push(value);
    }
  }
  const body = Buffer.concat(chunks);
  return { ok: res.ok, status: res.status, headers: res.headers, body, text: () => body.toString("utf8"), json: () => JSON.parse(body.toString("utf8")) };
}
