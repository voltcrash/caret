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
  type Playback =
    | { phase: "ended" | "paused" }
    | { phase: "playing"; source: AudioBufferSourceNode };
  type Voice = { playback: Playback };
  const voices: Voice[] = [{ playback: { phase: "ended" } }];
  type SampleState =
    | { phase: "loading"; queued?: () => void }
    | { phase: "ready"; buffer: AudioBuffer }
    | { phase: "failed" | "disposed" };
  let sample: SampleState = { phase: "loading" };
  const loading = new AbortController();
  const run = (action: () => void): void => {
    if (signal.aborted) return;
    if (sample.phase === "loading") sample.queued = action;
    else if (sample.phase === "ready") action();
  };
  const stopVoice = (voice: Voice): void => {
    if (voice.playback.phase === "playing") {
      voice.playback.source.onended = null;
      voice.playback.source.stop();
      voice.playback.source.disconnect();
    }
    voice.playback = { phase: "ended" };
  };
  const startVoice = (voice: Voice): void => {
    if (sample.phase !== "ready") return;
    const source = context.createBufferSource();
    source.buffer = sample.buffer;
    source.connect(destination);
    source.onended = () => {
      source.disconnect();
      if (
        voice.playback.phase === "playing" &&
        voice.playback.source === source
      ) {
        voice.playback = { phase: "ended" };
      }
    };
    voice.playback = { phase: "playing", source };
    source.start();
    if (context.state !== "running" && context.state !== "closed") {
      void context.resume().catch(() => undefined);
    }
  };
  void fetch(src, { signal: AbortSignal.any([signal, loading.signal]) })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Sound load failed: ${response.status}`);
      }
      const bytes = await response.arrayBuffer();
      if (loading.signal.aborted || signal.aborted) return;
      const decoded = await context.decodeAudioData(bytes);
      if (loading.signal.aborted || signal.aborted) return;
      if (sample.phase !== "loading") return;
      const action = sample.queued;
      sample = { phase: "ready", buffer: decoded };
      action?.();
    })
    .catch(() => {
      // Like an unhandled Howl loaderror, unavailable samples stay silent.
      if (sample.phase !== "disposed") sample = { phase: "failed" };
    });
  return {
    seek: () => {
      if (sample.phase !== "ready") return;
      run(() => {
        const voice = voices[0];
        if (voice === undefined) return;
        const playing = voice.playback.phase === "playing";
        stopVoice(voice);
        voice.playback = { phase: "paused" };
        if (playing) startVoice(voice);
      });
    },
    play: () =>
      run(() => {
        // Preserve seek(0); play(): rewind the first active voice, then overlap
        // with another. A stopped/ended first voice is reused instead.
        const paused = voices.filter(
          (voice) => voice.playback.phase === "paused",
        );
        if (paused.length !== 1) {
          // Drain surplus ended voices from the tail before recycling one.
          let idle = voices.filter(
            (voice) => voice.playback.phase === "ended",
          ).length;
          for (let i = voices.length - 1; i >= 0 && idle > 5; i--) {
            if (voices[i]?.playback.phase === "ended") {
              voices.splice(i, 1);
              idle--;
            }
          }
        }
        let voice =
          paused.length === 1
            ? paused[0]
            : voices.find((voice) => voice.playback.phase === "ended");
        if (voice === undefined) {
          voice = { playback: { phase: "ended" } };
          voices.push(voice);
        }
        startVoice(voice);
      }),
    stop: () => {
      if (sample.phase === "loading") delete sample.queued;
      voices.forEach(stopVoice);
    },
    unload: () => {
      sample = { phase: "disposed" };
      loading.abort();
      voices.forEach(stopVoice);
    },
  };
}
