import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

// Single module-level player: only one audio message plays at a time across the app.
let player: AudioPlayer | null = null;
let currentId: string | null = null;
let sub: { remove: () => void } | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribePlayback(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getPlayingId() {
  return currentId;
}

export function stopPlayback() {
  if (sub) {
    sub.remove();
    sub = null;
  }
  if (player) {
    try {
      player.remove();
    } catch {}
    player = null;
  }
  currentId = null;
  emit();
}

export async function togglePlayback(id: string, uri: string) {
  if (currentId === id) {
    stopPlayback();
    return;
  }
  stopPlayback();
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  } catch {}
  player = createAudioPlayer({ uri });
  currentId = id;
  emit();
  sub = player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) {
      stopPlayback();
    }
  });
  player.play();
}
