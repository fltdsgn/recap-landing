import { createVoiceOrb, VoiceEngine } from './voice-orb.js';

// Same live Canvas2D waveform as the real recap meeting screen (see
// voice-orb.js, copied verbatim from recap/assets/js). A landing page has
// no meeting to actually listen to, so it always runs the procedural
// fallback motion - `active` is set directly instead of calling
// VoiceEngine.start(), which would otherwise prompt for microphone access.
const container = document.getElementById('service-wave-orb');
if (container) {
  const orb = createVoiceOrb(container, { voiceSensitivity: 1.5 });
  VoiceEngine.active = true;
  orb.setPaused(false);
}
