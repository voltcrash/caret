import { afterEach, expect, it, vi } from "vite-plus/test";
import { clickSoundConfig } from "../../src/ts/constants/sounds";
import { createAudioSample } from "../../src/app/audio-sample.client";

const src = new URL("../../static/sounds/error1/1.wav", import.meta.url).href;
afterEach(() => vi.restoreAllMocks());

it("decodes a real sound and applies the master volume to rendered samples", async () => {
  const bytes = await (await fetch(src)).arrayBuffer();
  const context = new OfflineAudioContext(1, 44100, 44100);
  const original = await context.decodeAudioData(bytes.slice(0));
  const gain = context.createGain();
  gain.gain.value = 0.25;
  gain.connect(context.destination);
  const start = vi.spyOn(context, "createBufferSource");
  const sound = createAudioSample(
    context,
    gain,
    src,
    new AbortController().signal,
  );
  sound.seek(0);
  sound.play();
  await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
  const rendered = await context.startRendering();
  const expected = original.getChannelData(0);
  const actual = rendered.getChannelData(0);
  expect(expected.some((value) => value !== 0)).toBe(true);
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    expect(actual[i]).toBeCloseTo((expected[i] ?? 0) * 0.25, 5);
  }
  sound.unload();
});

it("preserves rewind plus overlap and cancels every voice on stop", async () => {
  const context = new OfflineAudioContext(1, 44100, 44100);
  const create = vi.spyOn(context, "createBufferSource");
  const sound = createAudioSample(
    context,
    context.destination,
    src,
    new AbortController().signal,
  );
  sound.seek(0);
  sound.play();
  await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
  sound.seek(0);
  sound.play();
  expect(create).toHaveBeenCalledTimes(3);
  sound.stop();
  const rendered = await context.startRendering();
  expect(rendered.getChannelData(0).every((value) => value === 0)).toBe(true);
  sound.unload();
});

it("keeps failed loads silent and discards playback queued before disposal", async () => {
  const context = new OfflineAudioContext(1, 44100, 44100);
  const create = vi.spyOn(context, "createBufferSource");
  const decode = vi.spyOn(context, "decodeAudioData");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 404 }),
  );
  const failed = createAudioSample(
    context,
    context.destination,
    src,
    new AbortController().signal,
  );
  failed.play();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  failed.unload();
  expect(create).not.toHaveBeenCalled();
  expect(decode).not.toHaveBeenCalled();
});

it("decodes every configured click, error and warning sample", async () => {
  const assets = import.meta.glob<string>("../../static/sounds/**/*.wav", {
    eager: true,
    query: "?url",
    import: "default",
  });
  const sources = [
    ...Object.values(clickSoundConfig).flat(),
    "../sounds/error1/1.wav",
    "../sounds/error2/1.wav",
    "../sounds/error3/1.wav",
    "../sounds/error4/1.wav",
    "../sounds/error4/2.wav",
    "../sounds/timeWarning.wav",
    "../sounds/fart-reverb.wav",
  ];
  const context = new OfflineAudioContext(1, 44100, 44100);
  for (const source of sources) {
    const url = assets[`../../static/${source.slice(3)}`];
    if (url === undefined) throw new Error(`Missing sound: ${source}`);
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    expect(decoded.duration).toBeGreaterThan(0);
  }
});

it.each([false, true])(
  "coalesces slow-load playback and honors stop=%s",
  async (stop) => {
    const bytes = await (await fetch(src)).arrayBuffer();
    const response = Promise.withResolvers<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValue(response.promise);
    const context = new OfflineAudioContext(1, 44100, 44100);
    const create = vi.spyOn(context, "createBufferSource");
    const decode = vi.spyOn(context, "decodeAudioData");
    const sound = createAudioSample(
      context,
      context.destination,
      src,
      new AbortController().signal,
    );
    for (let i = 0; i < 1_000; i++) {
      sound.seek(0);
      sound.play();
    }
    if (stop) sound.stop();
    response.resolve(new Response(bytes));
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
    // Await the actual decode, then the sample's continuation.
    await decode.mock.results[0]?.value;
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(stop ? 0 : 1);
    sound.unload();
  },
);

it("aborts an unloaded sample without aborting the audio owner", () => {
  const owner = new AbortController();
  const fetchSample = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 404 }));
  const context = new OfflineAudioContext(1, 44100, 44100);
  const sound = createAudioSample(
    context,
    context.destination,
    src,
    owner.signal,
  );
  const signal = fetchSample.mock.calls[0]?.[1]?.signal;
  expect(signal?.aborted).toBe(false);
  sound.unload();
  expect(signal?.aborted).toBe(true);
  expect(owner.signal.aborted).toBe(false);
});
