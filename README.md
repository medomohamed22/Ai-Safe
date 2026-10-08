# RoboMind G1 — fixed browser build

## Why the previous HTML failed
The previous esm.sh import included Node-specific `module.require` wrappers, which Android Chrome cannot execute. The official MuJoCo WebAssembly package needs a bundler and a served WASM binary. This project uses Vite and a local single-threaded `.wasm` file, **not** esm.sh.

## Run
Install Node.js 20.19+ or 22.12+; from this folder:

```bash
npm install
npm run dev
```
Open the local URL shown by Vite (usually `http://localhost:5173`). For a phone, connect it to the same Wi-Fi and use the computer's LAN IP and port `5173`. **Do not open index.html as a file.** Chrome on Android may need adequate RAM and GPU.

To publish:
```
npm run build
```
Host the generated `dist` directory on a static HTTPS host.

## What loads
Google DeepMind's original `unitree_g1` MJCF and STL assets via raw.githubusercontent.com; requires network. MuJoCo bindings and `.wasm` are local after npm install. Gravity uses (0,0,-9.81). No pretrained walking policy is included. JSON trajectories do not constitute a trained policy; standing is not stabilized.

## Verification status
Syntax checks and local static-serve checks only. Browser runtime **not fully verified** in this environment. If loading fails open the engine log and browser devtools; do not assume the scene ran.
