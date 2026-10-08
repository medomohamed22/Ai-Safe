# RoboMind v0.5
New files: `index.html`, `src/main.js`. Keep `package.json` and Vite config from v0.4.1.

Features: press and hold directional buttons for JOINT GAIT DEMO; stop on release; adjustable tempo; G1 MJCF actuator-name mapping; read named torso and pelvis IMU channels when present; automatic movement-command stop on fall; reset to first MJCF keyframe where available. This is NOT a pretrained locomotion policy, will not keep balance and is NOT tested for real robots.

Use npm install && npm run dev / Vercel build. Test WASM in Chrome.
