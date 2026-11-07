# Design Art in VRoid Studio (about 45 minutes, free)

**Why:** VRoid exports a VRM file, an open 3D-avatar standard. It comes with a ready skeleton, facial expressions (happy, sad, surprised, angry, relaxed, blink) and hair/cloth physics. The site animates all of these live with the `three-vrm` library.

**Shell:** none; you only use the VRoid Studio app. **Cost:** free. You don't need to sign in to export.

## 1. Install
1. Go to https://vroid.com/en/studio and click **Download** (Windows). It is also on Steam if you prefer.
2. Run the installer and open **VRoid Studio**.

Expected result: the start screen shows **New** and **Open**.

## 2. Start the character
1. Click **New** and pick the **male** base model.

Expected result: a default male avatar in the centre.

## 3. Face (calm, warm, 40s)
In the **Face** tab:
1. **Eyes:** pick a calmer, slightly narrower shape. Set the iris to warm dark brown.
2. **Eyebrows:** choose a thicker, straight pair.
3. **Skin (Body tab → Skin):** use a warm tone.
4. **Optional cyan temple line:** in Face → **Edit texture**, add a layer and paint a thin cyan line (`#22D3EE`) at his right temple near the hairline.

## 4. Hair (black, slicked back, side part)
In the **Hairstyle** tab:
1. Pick a short preset that is swept back.
2. Set the colour to near-black (`#0C0E13`).
3. Optional: use **Hair Guide** to push the fringe back and to one side.

## 5. Outfit (black suit, grey shirt, black tie)
In the **Outfit** tab:
1. **Tops:** choose a blazer or suit jacket. Set it to black, with the inner shirt grey (`#9AA4B1`).
2. **Bottoms:** black trousers. **Shoes:** black.
3. A tie is optional (some presets include one).
4. Skip the robotic hand. I'll add a silver robotic right hand in code.

> It doesn't need to match the paintings exactly. "Warm, dignified butler in a black suit" is the goal.

## 6. Export as VRM (keep the file small for the web)
1. Click the **share/export icon** (top right), then **Export as VRM**.
2. Pick **VRM 1.0**.
3. Turn on **Reduce polygons**: set Hair to about 50% and the rest to about 50–70%.
4. Set **Texture atlas resolution** to **2048** (or 1024 if the file is over 10 MB). Turn on **Delete transparent meshes** if offered.
5. Fill in the details:
   - Name: `Art`
   - Author: `Obedience ART`
   - Avatar use: **Only author**
   - Commercial use: **Allow**
6. Save it as `art.vrm` in:
   `C:\Users\shubh\Documents\obedience-art\public\models\` (create the `models` folder).

Expected result: an `art.vrm` file of about **5–15 MB**.

**Common failure:** the file is over 20 MB. Re-export with texture atlas 1024 and more polygon reduction.

## 7. Pack it for the web (PowerShell, in the project folder)
```powershell
node scripts/pack-model.mjs public\models\Art.vrm
```
Expected result: `Saved public/models/art.vrm.gz` (about 3–4 MB).

## 8. Tell me in the thread
Reply "art.vrm is ready". I'll then wire it in, tune his expressions and moves, and send you a preview video.

## Teardown
If you drop him, delete `public\models\art.vrm` and uninstall VRoid Studio from **Settings → Apps**.
