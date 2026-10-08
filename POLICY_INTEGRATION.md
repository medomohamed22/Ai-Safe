# RoboMind v0.6 — ONNX research integration

Install via `npm install && npm run dev` or deploy on Vercel; Vite copies MuJoCo and ONNX WASM.

Upload both your `.onnx` model and a corresponding `manifest.json` at once. No pretrained model is bundled. **Do not use any real robot**: browser simulation only.

The supplied `policy_manifest_template.json` is intentionally not ready: replace with values read from the actual training config. It is not a universal interchange standard. The supported adapter has 29 outputs and either 96 or 242 inputs; 242 includes 143 training-mean terrain scan values. Other trained policies, especially 47-to-12 LSTM variants, require separate adapters and cannot be safely used with this one.

The 96 layout is [local angular velocity 3, projected gravity 3, velocity command 3, joint position offset 29, joint velocities 29, previous action 29]. The 242 layout adds local linear velocity 3 first and terrain scan 143 last. Observation scale is explicit per element, and output targets are `defaultJointPos + actionScale * action`. Assumes MuJoCo position actuators with compatible units, and uses actuator control-range clipping. The async browser inference loop is not hard real-time. Validation of observation coordinates, sensor semantics, control frequency, policy normalization, gains, and initial posture against training configuration is required.

IMPORTANT: The included manifest requires values from the exact checkpoint. `actuatorKp/Kd` are recorded for compatibility checks but **not applied** to the MJCF controller; matching controller gains is a separate required engineering change. Do not claim gait stabilization without measured simulation results. If timing or stability is poor, use native Python MuJoCo to benchmark first.

The legacy five-trial evaluator is NOT a valid RL performance evaluation because trials lack reset diversity and async inference; the UI explicitly disables it for ONNX.

Sources: https://github.com/SunnyDeshpande/visuomotor-rl-humanoid-locomotion , https://github.com/IO-AI-TECH/onnx_policy , https://github.com/google-deepmind/mujoco_menagerie/tree/main/unitree_g1
