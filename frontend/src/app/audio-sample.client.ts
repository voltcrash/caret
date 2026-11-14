/** The sample operations used by the app; resources belong to its audio owner. */
export type AudioSample = {
  seek: (position: 0) => void;
  play: () => void;
  stop: () => void;
  unload: () => void;
};

export function createAudioSample(
  context: BaseAudioContext & { resume: () => Promise<void> },
  destination: AudioNode,
  src: string,
  signal: AbortSignal,
): AudioSample {
  type Voice = { source?: AudioBufferSourceNode; ended: boolean };
  const voices: Voice[] = [{ ended: true }];
  let buffer: AudioBuffer | undefined;
  let disposed = false;
  let failed = false;
  const queued: (() => void)[] = [];
  const run = (action: () => void): void => {
    if (disposed || failed || signal.aborted) return;
    if (buffer === undefined) queued.push(action);
    else action();
  };
  const stopVoice = (voice: Voice): void => {
    if (voice.source !== undefined) {
      voice.source.onended = null;
      voice.source.stop();
      voice.source.disconnect();
      voice.source = undefined;
    }
    voice.ended = true;
  };
  const startVoice = (voice: Voice): void => {
    if (buffer === undefined) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    source.onended = () => {
      source.disconnect();
      if (voice.source === source) {
        voice.source = undefined;
        voice.ended = true;
      }
    };
    voice.source = source;
    voice.ended = false;
    source.start();
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
  };
  void fetch(src, { signal })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Sound load failed: ${response.status}`);
      }
      const bytes = await response.arrayBuffer();
      if (disposed || signal.aborted) return;
      const decoded = await context.decodeAudioData(bytes);
      if (disposed || signal.aborted) return;
      buffer = decoded;
      for (const action of queued.splice(0)) action();
    })
    .catch(() => {
      // Like an unhandled Howl loaderror, unavailable samples stay silent.
      failed = true;
      queued.length = 0;
    });
  return {
    seek: () =>
      run(() => {
        const voice = voices[0];
        if (voice === undefined) return;
        const playing = voice.source !== undefined;
        stopVoice(voice);
        voice.ended = false;
        if (playing) startVoice(voice);
      }),
    play: () =>
      run(() => {
        // Preserve seek(0); play(): rewind the first active voice, then overlap
        // with another. A stopped/ended first voice is reused instead.
        const paused = voices.filter(
          (voice) => !voice.ended && voice.source === undefined,
        );
        if (paused.length !== 1) {
          // Drain surplus ended voices from the tail before recycling one.
          let idle = voices.filter((voice) => voice.ended).length;
          for (let i = voices.length - 1; i >= 0 && idle > 5; i--) {
            if (voices[i]?.ended) {
              voices.splice(i, 1);
              idle--;
            }
          }
        }
        let voice =
          paused.length === 1 ? paused[0] : voices.find((voice) => voice.ended);
        if (voice === undefined) {
          voice = { ended: true };
          voices.push(voice);
        }
        startVoice(voice);
      }),
    stop: () =>
      run(() => {
        voices.forEach(stopVoice);
      }),
    unload: () => {
      disposed = true;
      queued.length = 0;
      voices.forEach(stopVoice);
      buffer = undefined;
    },
  };
}
