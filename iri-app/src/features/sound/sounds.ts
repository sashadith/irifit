import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * App-Töne (Session 18). Bewusst sparsam: nur drei Momente, alle kurz und leise.
 * Abschaltbar über den Erinnerungen-Screen; die Einstellung liegt lokal, weil
 * sie gerätebezogen ist (Kopfhörer, Nachtmodus …).
 */
const SOUND_ENABLED_KEY = 'iri.sound.enabled.v1';

const FILES = {
  water: require('../../../assets/sounds/water-drop.wav'),
  scan: require('../../../assets/sounds/scan-done.wav'),
  streak: require('../../../assets/sounds/streak.wav'),
  // Feuerwerk zum Konfetti bei 10.000 Schritten (Sascha 20.08.) — der einzige
  // laengere Ton der App, weil er das Konfetti begleitet und nicht nur quittiert
  stepGoal: require('../../../assets/sounds/steps-goal.wav'),
} as const;

export type SoundName = keyof typeof FILES;

let enabled = true;
const players: Partial<Record<SoundName, ReturnType<typeof createAudioPlayer>>> = {};

/** Beim App-Start einmal aufrufen — lädt die gespeicherte Einstellung */
export async function initSounds() {
  /* Als MISCHTON anmelden (Sascha 18.08.: „Wassertropfen stoppt Spotify").
     Ohne das behandelt iOS jede tonausgebende App als Hauptdarsteller und
     pausiert laufende Musik oder Podcasts — fuer drei kurze UI-Toene absurd.
     mixWithOthers legt unsere Toene ueber die Musik, ohne sie anzufassen;
     Android hat kein echtes Mischen dieser Art, dort senkt duckOthers die
     Musik fuer den Moment kurz ab statt sie zu stoppen. */
  await setAudioModeAsync({
    interruptionMode: 'mixWithOthers',
    interruptionModeAndroid: 'duckOthers',
    playsInSilentMode: false,
  }).catch(() => {});
  const stored = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
  enabled = stored !== 'off';
}

export async function isSoundEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
  return stored !== 'off';
}

export async function setSoundEnabled(next: boolean) {
  enabled = next;
  await AsyncStorage.setItem(SOUND_ENABLED_KEY, next ? 'on' : 'off');
}

/**
 * Spielt einen Ton — nie blockierend, Fehler sind egal (ein stummer Ton darf
 * niemals eine Nutzeraktion aufhalten). Player werden wiederverwendet.
 */
export function playSound(name: SoundName) {
  if (!enabled) return;
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(FILES[name]);
      player.volume = name === 'water' ? 0.45 : 0.6;
      players[name] = player;
    }
    player.seekTo(0);
    player.play();
  } catch {
    // stumm scheitern
  }
}
