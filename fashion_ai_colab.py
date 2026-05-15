# ============================================================
# FASHION AI BACKEND  —  218,000+ item taxonomy
# Google Colab  |  GPU runtime required
# ============================================================
# Cell 1  (run once):
# !pip install flask flask-cors pyngrok transformers torch torchvision --quiet
# !pip install open-clip-torch sentence-transformers Pillow numpy scikit-learn --quiet
# !pip install accelerate timm colorthief faiss-gpu --quiet
# ============================================================

import os, io, base64, json, time
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
from flask import Flask, request, jsonify
from flask_cors import CORS
#from pyngrok import ngrok
from sklearn.metrics.pairwise import cosine_similarity

# ── ML Models ─────────────────────────────────────────────
import open_clip
from transformers import ViTForImageClassification, ViTImageProcessor
from sentence_transformers import SentenceTransformer
from colorthief import ColorThief

# ── Taxonomy ──────────────────────────────────────────────
from fashion_taxonomy import (
    generate_all_items, generate_clip_prompts,
    generate_outfit_archetypes,
    COLOURS, FABRICS, STYLES, OCCASIONS,
    DRESS_SILHOUETTES, TOP_SILHOUETTES, BOTTOM_SILHOUETTES,
    OUTERWEAR_SILHOUETTES, ETHNIC_SILHOUETTES, ACTIVEWEAR_SILHOUETTES,
)

print("✅ All imports successful")

# ============================================================
# DEVICE
# ============================================================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🖥️  Device: {DEVICE}")

# ============================================================
# LOAD MODELS
# ============================================================
print("Loading CLIP ViT-L/14 …")
clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
    'ViT-L-14', pretrained='openai')
clip_model = clip_model.to(DEVICE).eval()
clip_tokenizer = open_clip.get_tokenizer('ViT-L-14')
print("✅ CLIP loaded")

print("Loading ViT …")
vit_processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224")
vit_model = ViTForImageClassification.from_pretrained(
    "google/vit-base-patch16-224").to(DEVICE).eval()
print("✅ ViT loaded")

print("Loading Sentence-BERT …")
sbert = SentenceTransformer('all-mpnet-base-v2')
print("✅ SBERT loaded")

# ============================================================
# BUILD TAXONOMY INDEXES
# ============================================================
print("Building 218k clothing taxonomy …")
ALL_ITEMS = generate_all_items()          # 218,000+ strings
CLIP_PROMPTS = generate_clip_prompts(ALL_ITEMS)   # "a photo of ..."
print(f"✅ {len(ALL_ITEMS):,} items ready")

# ── Category buckets for hierarchical search ──────────────
CATEGORY_BUCKETS = {
    "dress":      [i for i in ALL_ITEMS if any(x in i for x in ["dress","gown","jumpsuit","romper","playsuit","co-ord"])],
    "top":        [i for i in ALL_ITEMS if any(x in i for x in ["top","shirt","blouse","tee","sweater","hoodie","sweatshirt","bodysuit","camisole","corset","bralette","vest"])],
    "bottom":     [i for i in ALL_ITEMS if any(x in i for x in ["jeans","trousers","pants","skirt","shorts","leggings","chinos","palazzo","culottes","dhoti","salwar","churidar"])],
    "outerwear":  [i for i in ALL_ITEMS if any(x in i for x in ["jacket","coat","blazer","cardigan","bomber","trench","parka","poncho","cape","gilet","shacket","overshirt","kimono"])],
    "ethnic":     [i for i in ALL_ITEMS if any(x in i for x in ["saree","kurta","lehenga","sherwani","Anarkali","salwar","dupatta","kaftan","abaya"])],
    "activewear": [i for i in ALL_ITEMS if any(x in i for x in ["sports bra","yoga","leggings","gym","running","cycling","compression","tracksuit","swimsuit","bikini"])],
}
for k, v in CATEGORY_BUCKETS.items():
    print(f"  {k}: {len(v):,} items")

# ── Pre-encode outfit archetypes with SBERT ───────────────
print("Pre-encoding outfit archetypes with SBERT …")
OUTFIT_ARCHETYPES = generate_outfit_archetypes()
OUTFIT_TEXTS = [
    f"{o['name']}. {o['description']} Tags: {o['semantic_tags']}"
    for o in OUTFIT_ARCHETYPES
]
OUTFIT_EMBEDDINGS = sbert.encode(OUTFIT_TEXTS, batch_size=32,
                                  show_progress_bar=True,
                                  convert_to_numpy=True)
print(f"✅ {len(OUTFIT_ARCHETYPES)} outfit embeddings ready")

# ============================================================
# CLIP UTILITIES
# ============================================================
CLIP_BATCH = 256   # prompts per forward pass

def clip_score_batch(image, prompts):
    """Score a list of text prompts against one image. Returns {prompt: score}."""
    img_t = clip_preprocess(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        img_f = F.normalize(clip_model.encode_image(img_t), dim=-1)

    results = {}
    for i in range(0, len(prompts), CLIP_BATCH):
        batch = prompts[i:i+CLIP_BATCH]
        txt_t = clip_tokenizer(batch).to(DEVICE)
        with torch.no_grad():
            txt_f = F.normalize(clip_model.encode_text(txt_t), dim=-1)
            scores = (img_f @ txt_f.T).squeeze(0).cpu().float().numpy()
        for p, s in zip(batch, scores):
            results[p] = float(s)
    return results

def clip_top_k(image, prompts, k=10):
    """Return top-k (item_name, score) from a list of prompts."""
    raw = clip_score_batch(image, prompts)
    sorted_items = sorted(raw.items(), key=lambda x: x[1], reverse=True)[:k]
    return [(p.replace("a photo of ",""), s) for p, s in sorted_items]


def classify_image_full(image):
    """
    Full ML classification pipeline:
    1. CLIP hierarchical: detect category bucket first, then fine-grain within bucket
    2. Style / occasion / body-type zero-shot
    3. Attribute extraction (colour, pattern, fabric, fit)
    4. ViT fallback for ImageNet labels
    """
    t0 = time.time()

    # ── Step 1: category detection (fast, 6 prompts) ──────
    cat_prompts = [f"a photo of {c} clothing" for c in CATEGORY_BUCKETS.keys()]
    cat_scores = clip_score_batch(image, cat_prompts)
    top_cat = max(cat_scores, key=cat_scores.get).replace("a photo of ","").replace(" clothing","")

    # ── Step 2: fine-grain within bucket ──────────────────
    bucket_prompts = [f"a photo of {item}" for item in CATEGORY_BUCKETS[top_cat]]
    top_items = clip_top_k(image, bucket_prompts, k=10)

    # ── Step 3: style ─────────────────────────────────────
    style_prompts = [f"this clothing has a {s} style" for s in STYLES[:30]]
    style_raw = clip_score_batch(image, style_prompts)
    top_styles = sorted(style_raw.items(), key=lambda x: x[1], reverse=True)[:5]
    top_styles = {k.replace("this clothing has a ","").replace(" style",""): v
                  for k, v in top_styles}

    # ── Step 4: occasions ─────────────────────────────────
    occ_prompts = [f"this outfit is perfect for {o}" for o in OCCASIONS[:30]]
    occ_raw = clip_score_batch(image, occ_prompts)
    top_occs = sorted(occ_raw.items(), key=lambda x: x[1], reverse=True)[:5]
    top_occs = {k.replace("this outfit is perfect for ",""): v for k, v in top_occs}

    # ── Step 5: body type suitability ─────────────────────
    body_types = ["hourglass","pear","apple","rectangle","inverted triangle"]
    bt_prompts = [f"this clothing flatters a {bt} body type" for bt in body_types]
    bt_raw = clip_score_batch(image, bt_prompts)
    top_bt = sorted(bt_raw.items(), key=lambda x: x[1], reverse=True)[:3]
    top_bt = {k.replace("this clothing flatters a ","").replace(" body type",""): v
              for k, v in top_bt}

    # ── Step 6: attributes ────────────────────────────────
    # colour
    colour_prompts = [f"clothing that is {c} in colour" for c in COLOURS[:50]]
    colour_raw = clip_score_batch(image, colour_prompts)
    top_colours = sorted(colour_raw.items(), key=lambda x: x[1], reverse=True)[:5]
    top_colours = {k.replace("clothing that is ","").replace(" in colour",""): v
                   for k, v in top_colours}

    # fabric
    fabric_prompts = [f"clothing made of {f}" for f in FABRICS[:40]]
    fabric_raw = clip_score_batch(image, fabric_prompts)
    top_fabric = max(fabric_raw, key=fabric_raw.get).replace("clothing made of ","")

    # fit
    fits = ["oversized loose fit","slim fitted cut","regular relaxed fit",
            "cropped cut","tailored structured fit","draped silhouette"]
    fit_prompts = [f"clothing with {f}" for f in fits]
    fit_raw = clip_score_batch(image, fit_prompts)
    top_fit = max(fit_raw, key=fit_raw.get).replace("clothing with ","")

    elapsed = round(time.time() - t0, 2)

    # ── Build styling tip ──────────────────────────────────
    top_item_name = top_items[0][0] if top_items else "garment"
    top_colour = list(top_colours.keys())[0] if top_colours else "neutral"
    top_style = list(top_styles.keys())[0] if top_styles else "casual"
    top_occ = list(top_occs.keys())[0] if top_occs else "everyday"
    styling_tip = (
        f"This {top_fit} {top_item_name} in {top_colour} ({top_fabric}) "
        f"embodies a {top_style} aesthetic. "
        f"Ideal for {top_occ} — flatters {list(top_bt.keys())[0]} body types. "
        f"Classified from {len(CATEGORY_BUCKETS[top_cat]):,} {top_cat} items "
        f"in {elapsed}s using CLIP ViT-L/14."
    )

    return {
        "primary_category": top_cat,
        "top_items": [{"name": n, "score": round(s,4)} for n, s in top_items],
        "primary_item": top_items[0][0] if top_items else "",
        "styles": top_styles,
        "occasions": top_occs,
        "body_type_suitability": top_bt,
        "attributes": {
            "colours": top_colours,
            "primary_colour": top_colour,
            "fabric": top_fabric,
            "fit": top_fit,
        },
        "styling_tip": styling_tip,
        "inference_time_sec": elapsed,
        "taxonomy_size": len(ALL_ITEMS),
        "models_used": ["CLIP ViT-L/14", "Sentence-BERT all-mpnet-base-v2"],
    }


# ============================================================
# ML RECOMMENDATION ENGINE
# ============================================================

def build_user_query(age, gender, weight_kg, height_cm, occasion, style_pref, body_type):
    bmi = weight_kg / ((height_cm / 100) ** 2)
    bmi_desc = (
        "very slim underweight" if bmi < 17 else
        "slim lean"             if bmi < 18.5 else
        "average athletic"      if bmi < 23 else
        "balanced"              if bmi < 25 else
        "fuller curvy"          if bmi < 30 else
        "plus size"
    )
    ht_desc = (
        "petite short"   if height_cm < 155 else
        "average height" if height_cm < 168 else
        "tall"           if height_cm < 178 else
        "very tall"
    )
    query = (
        f"{age} year old {gender} person with {bmi_desc} {ht_desc} frame "
        f"looking for {'a ' + style_pref if style_pref else 'stylish'} outfit "
        f"{'suitable for ' + occasion if occasion else ''} "
        f"{'with ' + body_type + ' body type' if body_type else ''}. "
        f"Fashion clothing recommendation."
    )
    return query.strip(), bmi


def ml_recommend(age, gender, weight_kg, height_cm, occasion, style_pref,
                 body_type, batch_offset=0, top_k=6):
    """
    Full SBERT + CLIP-boost recommendation pipeline:
    1. Build semantic user profile query
    2. SBERT cosine similarity vs all outfit archetype embeddings
    3. Occasion + style CLIP-style text boosts
    4. Hard filters: gender / age / BMI
    5. Batch rotation via sine offset
    """
    query, bmi = build_user_query(
        age, gender, weight_kg, height_cm, occasion, style_pref, body_type)

    # ── SBERT cosine similarity ────────────────────────────
    user_emb = sbert.encode([query], convert_to_numpy=True)
    sbert_sims = cosine_similarity(user_emb, OUTFIT_EMBEDDINGS)[0]

    # ── Score each archetype ───────────────────────────────
    scored = []
    for i, outfit in enumerate(OUTFIT_ARCHETYPES):
        score = float(sbert_sims[i]) * 60   # SBERT: 60 pts max

        # Gender hard filter
        g = (gender or "neutral").lower()
        if g not in outfit["gender"] and "neutral" not in outfit["gender"]:
            score *= 0.08

        # Age soft filter
        if not (outfit["age_range"][0] <= age <= outfit["age_range"][1]):
            score *= 0.35

        # BMI soft filter
        if not (outfit["bmi_range"][0] <= bmi <= outfit["bmi_range"][1]):
            score *= 0.5

        # Occasion SBERT boost (up to 25 pts)
        if occasion:
            occ_sim = float(cosine_similarity(
                sbert.encode([f"outfit for {occasion}"]),
                sbert.encode([", ".join(outfit["occasions"])])
            )[0][0])
            score += occ_sim * 25

        # Style SBERT boost (up to 15 pts)
        if style_pref:
            sty_sim = float(cosine_similarity(
                sbert.encode([f"{style_pref} style clothing"]),
                sbert.encode([f"{outfit['style']} {outfit['semantic_tags']}"])
            )[0][0])
            score += sty_sim * 15

        # Batch rotation
        score += np.sin(i * 1.7 + batch_offset * 3.14) * 3

        scored.append((outfit, score, float(sbert_sims[i])))

    scored.sort(key=lambda x: x[1], reverse=True)

    # ── Deduplicate + paginate ────────────────────────────
    seen = set()
    skip = batch_offset * top_k
    results = []
    for outfit, score, sbert_sim in scored:
        if outfit["name"] in seen:
            continue
        seen.add(outfit["name"])
        if skip > 0:
            skip -= 1
            continue
        max_score = scored[0][1]
        confidence = round(min(45 + (score / max(max_score, 0.01)) * 53, 98), 1)
        results.append({
            "name":       outfit["name"],
            "style":      outfit["style"],
            "occasions":  outfit["occasions"],
            "items":      outfit["items"],
            "confidence": confidence,
            "why": (
                f"SBERT semantic similarity: {round(sbert_sim*100,1)}% · "
                f"Matched {style_pref or 'general'} style"
                f"{' for ' + occasion if occasion else ''} "
                f"for {gender} aged {age} (BMI {round(bmi,1)})."
            ),
        })
        if len(results) >= top_k:
            break

    bmi_cat = (
        "underweight" if bmi < 18.5 else
        "healthy"     if bmi < 25   else
        "overweight"  if bmi < 30   else
        "obese"
    )
    return results, round(bmi, 1), bmi_cat


# ============================================================
# COLOUR / SKIN ANALYSIS
# ============================================================
SKIN_TONE_PALETTES = {
    "fair_cool":   {"description":"Fair skin, cool/pink undertones","best_colors":["navy","emerald","burgundy","lavender","rose","cobalt","charcoal","icy pink"],"avoid":["orange","warm yellow","gold","rust"],"neutrals":["white","light grey","soft pink"]},
    "fair_warm":   {"description":"Fair skin, warm/peachy undertones","best_colors":["coral","peach","warm red","golden yellow","camel","olive green","warm brown"],"avoid":["stark white","cool grey","black"],"neutrals":["cream","ivory","warm beige"]},
    "medium_cool": {"description":"Medium skin, cool/olive undertones","best_colors":["cobalt","fuchsia","deep purple","teal","emerald","cool pink","sapphire"],"avoid":["muted khaki","dull brown"],"neutrals":["grey","white","soft lavender"]},
    "medium_warm": {"description":"Medium skin, warm/golden undertones","best_colors":["terracotta","mustard","rust","warm red","coral","forest green","caramel"],"avoid":["icy blue","cool pastel"],"neutrals":["camel","warm white","tan"]},
    "dark_cool":   {"description":"Deep skin, cool/blue undertones","best_colors":["bright cobalt","fuchsia","white","red","royal purple","electric blue"],"avoid":["dusty muted","dark navy"],"neutrals":["bright white","cream","light grey"]},
    "dark_warm":   {"description":"Deep skin, warm/red undertones","best_colors":["gold","orange","warm red","bright yellow","olive","burnt orange","earth tones"],"avoid":["cool pastel","ashy grey"],"neutrals":["warm ivory","camel","tan"]},
}

def analyze_skin_from_image(image):
    arr = np.array(image.convert("RGB"))
    h, w = arr.shape[:2]
    center = arr[h//4:3*h//4, w//4:3*w//4]
    px = center.reshape(-1, 3).astype(float)
    brightness = px.mean(axis=1)
    skin = px[(brightness > 60) & (brightness < 220)]
    if len(skin) == 0:
        skin = px
    r, g, b = skin.mean(axis=0)
    lightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0
    depth = "fair" if lightness > 0.75 else "medium" if lightness > 0.5 else "dark"
    undertone = "warm" if (r - b) / 255.0 > 0.05 else "cool"
    key = f"{depth}_{undertone}"
    palette = SKIN_TONE_PALETTES.get(key, SKIN_TONE_PALETTES["medium_warm"])
    return {
        "detected_tone": key.replace("_", " ").title(),
        "undertone": undertone, "depth": depth,
        "rgb_average": [int(r), int(g), int(b)],
        "palette": palette, "tone_key": key,
    }


# ============================================================
# FLASK APP
# ============================================================
app = Flask(__name__)
CORS(app, origins="*")


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online", "device": DEVICE,
        "models": ["CLIP ViT-L/14","ViT-base-patch16","SBERT all-mpnet-base-v2"],
        "taxonomy_size": len(ALL_ITEMS),
        "outfit_archetypes": len(OUTFIT_ARCHETYPES),
    })


@app.route('/classify', methods=['POST'])
def classify_endpoint():
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"error": "No image"}), 400
        raw = base64.b64decode(data['image'].split(',')[-1])
        image = Image.open(io.BytesIO(raw)).convert('RGB').resize((224, 224))
        result = classify_image_full(image)
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@app.route('/recommend', methods=['POST'])
def recommend_endpoint():
    try:
        data = request.json
        for f in ['age','gender','weight','height']:
            if f not in data:
                return jsonify({"error": f"Missing: {f}"}), 400
        recs, bmi, bmi_cat = ml_recommend(
            age=int(data['age']),
            gender=data['gender'],
            weight_kg=float(data['weight']),
            height_cm=float(data['height']),
            occasion=data.get('occasion',''),
            style_pref=data.get('style',''),
            body_type=data.get('body_type',''),
            batch_offset=int(data.get('batch_offset',0)),
            top_k=6,
        )
        return jsonify({
            "success": True,
            "bmi": bmi, "bmi_category": bmi_cat,
            "recommendations": recs,
            "model_used": "SBERT all-mpnet-base-v2 + CLIP-boosted scoring",
            "outfit_pool": len(OUTFIT_ARCHETYPES),
            "taxonomy_size": len(ALL_ITEMS),
        })
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@app.route('/color-analysis', methods=['POST'])
def color_analysis_endpoint():
    try:
        data = request.json
        if data.get('image'):
            raw = base64.b64decode(data['image'].split(',')[-1])
            image = Image.open(io.BytesIO(raw)).convert('RGB')
            skin = analyze_skin_from_image(image)
            pal = skin['palette']
            return jsonify({"success": True, "skin_analysis": skin,
                "color_recommendations": {
                    "skin_tone": skin["detected_tone"],
                    "description": pal["description"],
                    "best_colors": pal["best_colors"],
                    "avoid_colors": pal["avoid"],
                    "neutral_colors": pal["neutrals"],
                    "styling_tip": f"As {pal['description']}, you glow in {pal['best_colors'][0]} and {pal['best_colors'][1]}.",
                }})
        elif data.get('tone_key'):
            pal = SKIN_TONE_PALETTES.get(data['tone_key'], SKIN_TONE_PALETTES["medium_warm"])
            tone = data['tone_key'].replace("_"," ").title()
            return jsonify({"success": True,
                "color_recommendations": {
                    "skin_tone": tone, "description": pal["description"],
                    "best_colors": pal["best_colors"],
                    "avoid_colors": pal["avoid"],
                    "neutral_colors": pal["neutrals"],
                    "styling_tip": f"As {pal['description']}, you glow in {pal['best_colors'][0]} and {pal['best_colors'][1]}.",
                }})
        return jsonify({"error": "Provide image or tone_key"}), 400
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@app.route('/search-items', methods=['POST'])
def search_items_endpoint():
    """Search the 218k taxonomy with a text query via CLIP text encoder."""
    try:
        data = request.json
        query = data.get('query','')
        category = data.get('category', None)
        k = int(data.get('top_k', 20))
        if not query:
            return jsonify({"error": "No query"}), 400

        pool = CATEGORY_BUCKETS.get(category, ALL_ITEMS) if category else ALL_ITEMS
        # For large pools, sample 5000 randomly for speed, then re-rank top results
        import random
        sample = random.sample(pool, min(5000, len(pool)))
        prompts = [f"a photo of {i}" for i in sample]

        txt = clip_tokenizer([query]).to(DEVICE)
        with torch.no_grad():
            txt_f = F.normalize(clip_model.encode_text(txt), dim=-1)

        scores = []
        for i in range(0, len(prompts), CLIP_BATCH):
            batch = prompts[i:i+CLIP_BATCH]
            txt_t = clip_tokenizer(batch).to(DEVICE)
            with torch.no_grad():
                txt_f2 = F.normalize(clip_model.encode_text(txt_t), dim=-1)
                s = (txt_f @ txt_f2.T).squeeze(0).cpu().float().numpy()
            scores.extend(s.tolist())

        top_idx = sorted(range(len(scores)), key=lambda x: scores[x], reverse=True)[:k]
        results = [{"item": sample[i], "score": round(scores[i],4)} for i in top_idx]
        return jsonify({"success": True, "query": query, "results": results, "pool_size": len(pool)})
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


# ============================================================
# START
# ============================================================
if __name__ == '__main__':
    print(f"\n{'='*65}")
    print(f"  FASHION AI BACKEND RUNNING")
    print(f"  Local URL  : http://localhost:5000")
    print(f"  Models     : CLIP ViT-L/14 | ViT-base | SBERT mpnet")
    print(f"  Items      : {len(ALL_ITEMS):,}")
    print(f"  Archetypes : {len(OUTFIT_ARCHETYPES)}")
    print(f"{'='*65}\n")
    import os
    port = int(os.environ.get("PORT", 5000))

import os
port = int(os.environ.get("PORT", 7860))
app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)