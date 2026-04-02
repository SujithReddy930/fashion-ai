import os
import io
import json
import base64
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
from flask import Flask, request, jsonify
from flask_cors import CORS
from pyngrok import ngrok

import open_clip

from transformers import ViTForImageClassification, ViTImageProcessor

from sentence_transformers import SentenceTransformer
from transformers import pipeline

from colorthief import ColorThief
import colorsys

print("✅ All imports successful")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🖥️  Using device: {DEVICE}")

print("Loading CLIP...")
clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
    'ViT-L-14', pretrained='openai'
)
clip_model = clip_model.to(DEVICE).eval()
clip_tokenizer = open_clip.get_tokenizer('ViT-L-14')
print("✅ CLIP loaded")

print("Loading ViT...")
VIT_MODEL_NAME = "google/vit-base-patch16-224"
vit_processor = ViTImageProcessor.from_pretrained(VIT_MODEL_NAME)
vit_model = ViTForImageClassification.from_pretrained(VIT_MODEL_NAME)
vit_model = vit_model.to(DEVICE).eval()
print("✅ ViT loaded")

print("Loading Sentence-BERT...")
sbert_model = SentenceTransformer('all-mpnet-base-v2')
print("✅ Sentence-BERT loaded")

CLOTHING_CATEGORIES = {
    "tops": ["t-shirt", "shirt", "blouse", "crop top", "tank top", "polo", "henley", "tunic", "sweater", "hoodie", "cardigan"],
    "bottoms": ["jeans", "trousers", "shorts", "skirt", "leggings", "chinos", "joggers", "culottes", "palazzo pants"],
    "dresses": ["maxi dress", "midi dress", "mini dress", "shirt dress", "wrap dress", "bodycon dress", "A-line dress", "shift dress"],
    "outerwear": ["jacket", "coat", "blazer", "trench coat", "parka", "bomber jacket", "windbreaker", "denim jacket"],
    "ethnic": ["saree", "salwar kameez", "kurta", "lehenga", "sherwani", "dhoti", "anarkali"],
    "formal": ["suit", "tuxedo", "evening gown", "cocktail dress", "formal trousers", "dress shirt"],
    "activewear": ["sports bra", "yoga pants", "gym shorts", "athletic top", "compression tights", "track suit"],
    "accessories": ["scarf", "belt", "hat", "bag", "shoes", "jewelry", "watch", "sunglasses"]
}

STYLE_TYPES = [
    "casual", "formal", "business casual", "smart casual", "bohemian", "streetwear",
    "preppy", "minimalist", "maximalist", "vintage", "classic", "romantic", "edgy",
    "athleisure", "ethnic traditional", "indo-western", "luxury", "grunge"
]

OCCASIONS = [
    "everyday casual", "office/work", "business meeting", "formal dinner",
    "wedding guest", "party/clubbing", "date night", "outdoor adventure",
    "gym/workout", "beach/vacation", "festival", "college/campus",
    "religious ceremony", "job interview", "brunch", "evening gala"
]

BODY_TYPES = {
    "hourglass": {
        "description": "Balanced shoulders and hips with a defined waist",
        "best_fits": ["wrap dresses", "fitted blazers", "high-waisted bottoms", "bodycon", "belted styles"],
        "avoid": ["boxy cuts", "shapeless silhouettes"]
    },
    "pear": {
        "description": "Hips wider than shoulders",
        "best_fits": ["A-line skirts", "wide-leg trousers", "off-shoulder tops", "structured shoulders"],
        "avoid": ["tight skirts at hip", "low-rise bottoms", "cargo pants"]
    },
    "apple": {
        "description": "Fuller midsection, slimmer legs",
        "best_fits": ["empire waist", "V-necklines", "flowy tops", "straight-leg trousers", "shift dresses"],
        "avoid": ["clingy fabrics at midsection", "belt emphasis at waist"]
    },
    "rectangle": {
        "description": "Shoulders, waist and hips roughly equal",
        "best_fits": ["peplum tops", "ruffled skirts", "layered outfits", "wrap styles", "cropped jackets"],
        "avoid": ["boxy shapeless cuts that flatten the figure"]
    },
    "inverted_triangle": {
        "description": "Shoulders broader than hips",
        "best_fits": ["A-line skirts", "wide-leg pants", "flared jeans", "boat necks carefully", "V-necks"],
        "avoid": ["shoulder pads", "boat necks", "horizontal stripes on top"]
    }
}

SKIN_TONE_PALETTES = {
    "fair_cool": {
        "description": "Fair skin with cool/pink undertones",
        "best_colors": ["navy", "royal blue", "emerald green", "burgundy", "charcoal", "lavender", "rose", "icy pink"],
        "avoid": ["orange", "warm yellow", "gold", "rust"],
        "neutrals": ["white", "light grey", "soft pink"]
    },
    "fair_warm": {
        "description": "Fair skin with warm/peachy undertones",
        "best_colors": ["coral", "peach", "warm red", "golden yellow", "camel", "warm brown", "olive green"],
        "avoid": ["black (harsh)", "stark white", "cool greys"],
        "neutrals": ["cream", "ivory", "warm beige"]
    },
    "medium_cool": {
        "description": "Medium skin with cool/olive undertones",
        "best_colors": ["jewel tones", "cobalt", "fuchsia", "deep purple", "teal", "emerald", "cool pink"],
        "avoid": ["muted earth tones", "dull khaki"],
        "neutrals": ["grey", "white", "soft lavender"]
    },
    "medium_warm": {
        "description": "Medium skin with warm/golden undertones",
        "best_colors": ["warm terracotta", "mustard", "rust", "warm red", "coral", "forest green", "caramel"],
        "avoid": ["cool pastels", "icy blues"],
        "neutrals": ["camel", "warm white", "tan"]
    },
    "dark_cool": {
        "description": "Deep skin with cool/blue undertones",
        "best_colors": ["bright cobalt", "fuchsia", "white", "red", "royal purple", "electric blue"],
        "avoid": ["dusty muted tones", "dark navy (blends)"],
        "neutrals": ["bright white", "cream", "light grey"]
    },
    "dark_warm": {
        "description": "Deep skin with warm/red undertones",
        "best_colors": ["gold", "orange", "warm red", "bright yellow", "olive", "burnt orange", "earth tones"],
        "avoid": ["cool pastels", "ashy greys"],
        "neutrals": ["warm ivory", "camel", "tan"]
    }
}

def classify_with_clip(image: Image.Image, candidates: list) -> dict:
    image_input = clip_preprocess(image).unsqueeze(0).to(DEVICE)
    text_inputs = clip_tokenizer(candidates).to(DEVICE)

    with torch.no_grad():
        image_features = clip_model.encode_image(image_input)
        text_features = clip_model.encode_text(text_inputs)
        image_features = F.normalize(image_features, dim=-1)
        text_features = F.normalize(text_features, dim=-1)
        similarity = (image_features @ text_features.T).squeeze(0)
        probs = F.softmax(similarity * 100, dim=0).cpu().numpy()

    results = {cand: float(prob) for cand, prob in zip(candidates, probs)}
    return dict(sorted(results.items(), key=lambda x: x[1], reverse=True))

def classify_clothing_type(image: Image.Image) -> dict:
    all_items = []
    item_to_category = {}
    for cat, items in CLOTHING_CATEGORIES.items():
        for item in items:
            all_items.append(f"a photo of {item}")
            item_to_category[f"a photo of {item}"] = cat

    raw_results = classify_with_clip(image, all_items)

    top_items = list(raw_results.items())[:5]
    category_scores = {}
    for prompt, score in raw_results.items():
        cat = item_to_category[prompt]
        category_scores[cat] = category_scores.get(cat, 0) + score

    return {
        "top_items": [(k.replace("a photo of ", ""), v) for k, v in top_items],
        "categories": dict(sorted(category_scores.items(), key=lambda x: x[1], reverse=True))
    }

def classify_style(image: Image.Image) -> dict:
    style_prompts = [f"this clothing has a {s} style" for s in STYLE_TYPES]
    results = classify_with_clip(image, style_prompts)
    clean = {k.replace("this clothing has a ", "").replace(" style", ""): v
             for k, v in list(results.items())[:5]}
    return clean

def classify_occasions(image: Image.Image) -> dict:
    occ_prompts = [f"this outfit is perfect for {o}" for o in OCCASIONS]
    results = classify_with_clip(image, occ_prompts)
    clean = {k.replace("this outfit is perfect for ", ""): v
             for k, v in list(results.items())[:5]}
    return clean

def classify_body_type_suitability(image: Image.Image) -> dict:
    body_prompts = [
        f"this clothing style is most flattering for {bt.replace('_', ' ')} body type"
        for bt in BODY_TYPES.keys()
    ]
    results = classify_with_clip(image, body_prompts)
    clean = {}
    for bt in BODY_TYPES.keys():
        prompt = f"this clothing style is most flattering for {bt.replace('_', ' ')} body type"
        if prompt in results:
            clean[bt] = results[prompt]
    return dict(sorted(clean.items(), key=lambda x: x[1], reverse=True))

def extract_garment_attributes(image: Image.Image) -> dict:
    colors = ["black", "white", "navy", "blue", "red", "green", "yellow",
              "pink", "purple", "orange", "brown", "grey", "beige", "multicolor"]
    color_prompts = [f"clothing that is {c} in color" for c in colors]
    color_results = classify_with_clip(image, color_prompts)
    top_colors = {k.replace("clothing that is ", "").replace(" in color", ""): v
                  for k, v in list(color_results.items())[:3]}

    patterns = ["solid/plain", "striped", "checkered/plaid", "floral", "geometric",
                "animal print", "abstract", "polka dots", "tie-dye", "camouflage"]
    pattern_prompts = [f"clothing with {p} pattern" for p in patterns]
    pattern_results = classify_with_clip(image, pattern_prompts)
    top_pattern = list(pattern_results.items())[0]
    top_pattern = (top_pattern[0].replace("clothing with ", "").replace(" pattern", ""), top_pattern[1])

    materials = ["cotton", "denim", "silk", "wool", "polyester", "linen", "leather", "velvet", "chiffon", "knit"]
    mat_prompts = [f"clothing made of {m}" for m in materials]
    mat_results = classify_with_clip(image, mat_prompts)
    top_material = list(mat_results.items())[0]
    top_material = (top_material[0].replace("clothing made of ", ""), top_material[1])

    fits = ["oversized loose fit", "slim fitted", "regular fit", "cropped", "relaxed fit"]
    fit_prompts = [f"clothing with {f}" for f in fits]
    fit_results = classify_with_clip(image, fit_prompts)
    top_fit = list(fit_results.items())[0]
    top_fit = (top_fit[0].replace("clothing with ", ""), top_fit[1])

    return {
        "colors": top_colors,
        "pattern": top_pattern[0],
        "material": top_material[0],
        "fit": top_fit[0]
    }

def bmi_to_body_type_estimate(weight_kg: float, height_cm: float) -> str:
    bmi = weight_kg / ((height_cm / 100) ** 2)
    if bmi < 18.5:
        return "slim/lean"
    elif bmi < 25:
        return "average"
    elif bmi < 30:
        return "overweight"
    else:
        return "plus size"

def recommend_outfits(
    age: int,
    gender: str,
    weight_kg: float,
    height_cm: float,
    occasion: str,
    style_pref: str,
    body_type: str = None
) -> list:

    bmi_cat = bmi_to_body_type_estimate(weight_kg, height_cm)

    user_profile = (
        f"{age}-year-old {gender}, {bmi_cat} build, {body_type or 'any'} body type, "
        f"looking for {style_pref} outfit for {occasion}"
    )

    outfit_templates = [
        {
            "name": "Classic Office Chic",
            "items": ["tailored blazer", "straight-leg trousers", "button-down shirt", "pointed-toe heels"],
            "style": "business casual",
            "occasions": ["office/work", "business meeting", "job interview"],
            "gender": ["female", "neutral"],
            "age_range": (20, 55),
            "bmi_cats": ["slim/lean", "average", "overweight"],
            "body_types": ["hourglass", "rectangle", "inverted_triangle"]
        },
        {
            "name": "Effortless Weekend Casual",
            "items": ["white t-shirt", "high-waisted jeans", "white sneakers", "crossbody bag"],
            "style": "casual",
            "occasions": ["everyday casual", "brunch", "college/campus"],
            "gender": ["female", "neutral"],
            "age_range": (16, 40),
            "bmi_cats": ["slim/lean", "average"],
            "body_types": ["hourglass", "rectangle", "pear"]
        },
        {
            "name": "Smart Casual Men's",
            "items": ["chinos", "polo shirt", "leather loafers", "minimalist watch"],
            "style": "smart casual",
            "occasions": ["office/work", "brunch", "date night"],
            "gender": ["male"],
            "age_range": (20, 50),
            "bmi_cats": ["slim/lean", "average", "overweight"],
            "body_types": ["all"]
        },
        {
            "name": "Evening Gala Glamour",
            "items": ["floor-length gown", "strappy heels", "clutch bag", "statement earrings"],
            "style": "formal",
            "occasions": ["evening gala", "formal dinner", "wedding guest"],
            "gender": ["female"],
            "age_range": (20, 65),
            "bmi_cats": ["slim/lean", "average"],
            "body_types": ["hourglass", "pear", "rectangle"]
        },
        {
            "name": "Boho Festival Look",
            "items": ["flowy maxi skirt", "crop top", "strappy sandals", "layered necklaces", "wide-brim hat"],
            "style": "bohemian",
            "occasions": ["festival", "beach/vacation", "outdoor adventure"],
            "gender": ["female", "neutral"],
            "age_range": (16, 35),
            "bmi_cats": ["slim/lean", "average", "overweight"],
            "body_types": ["all"]
        },
        {
            "name": "Streetwear Edge",
            "items": ["oversized hoodie", "cargo pants", "chunky sneakers", "baseball cap"],
            "style": "streetwear",
            "occasions": ["everyday casual", "college/campus", "outdoor adventure"],
            "gender": ["male", "neutral"],
            "age_range": (15, 30),
            "bmi_cats": ["slim/lean", "average"],
            "body_types": ["all"]
        },
        {
            "name": "Ethnic Elegance",
            "items": ["silk saree / anarkali suit", "ethnic jewelry", "embroidered clutch", "kolhapuri sandals"],
            "style": "ethnic traditional",
            "occasions": ["religious ceremony", "wedding guest", "festival"],
            "gender": ["female"],
            "age_range": (16, 70),
            "bmi_cats": ["slim/lean", "average", "overweight", "plus size"],
            "body_types": ["all"]
        },
        {
            "name": "Date Night Chic",
            "items": ["midi wrap dress", "block heels", "delicate necklace", "small handbag"],
            "style": "romantic",
            "occasions": ["date night", "party/clubbing", "evening gala"],
            "gender": ["female"],
            "age_range": (18, 45),
            "bmi_cats": ["slim/lean", "average"],
            "body_types": ["hourglass", "pear", "apple"]
        },
        {
            "name": "Power Suit Look",
            "items": ["structured suit jacket", "matching trousers", "crisp white shirt", "Oxford shoes"],
            "style": "formal",
            "occasions": ["business meeting", "job interview", "formal dinner"],
            "gender": ["male", "neutral"],
            "age_range": (22, 60),
            "bmi_cats": ["slim/lean", "average", "overweight"],
            "body_types": ["all"]
        },
        {
            "name": "Athleisure Everyday",
            "items": ["matching tracksuit", "sports bra", "joggers", "white sneakers", "baseball cap"],
            "style": "athleisure",
            "occasions": ["gym/workout", "everyday casual", "outdoor adventure"],
            "gender": ["female", "male", "neutral"],
            "age_range": (15, 45),
            "bmi_cats": ["slim/lean", "average"],
            "body_types": ["all"]
        },
        {
            "name": "Plus-Size Chic",
            "items": ["empire waist tunic", "wide-leg palazzo pants", "wedge sandals", "statement necklace"],
            "style": "casual",
            "occasions": ["everyday casual", "brunch", "office/work"],
            "gender": ["female"],
            "age_range": (20, 60),
            "bmi_cats": ["overweight", "plus size"],
            "body_types": ["apple", "pear"]
        },
        {
            "name": "Minimalist Monochrome",
            "items": ["monochrome turtleneck", "slim trousers", "clean white sneakers", "structured tote"],
            "style": "minimalist",
            "occasions": ["office/work", "everyday casual", "business meeting"],
            "gender": ["female", "neutral"],
            "age_range": (20, 50),
            "bmi_cats": ["slim/lean", "average"],
            "body_types": ["all"]
        }
    ]

    outfit_texts = [
        f"{o['style']} outfit of {', '.join(o['items'])} suitable for {', '.join(o['occasions'][:2])}"
        for o in outfit_templates
    ]

    user_embedding = sbert_model.encode([user_profile])
    outfit_embeddings = sbert_model.encode(outfit_texts)

    from sklearn.metrics.pairwise import cosine_similarity
    scores = cosine_similarity(user_embedding, outfit_embeddings)[0]

    for i, outfit in enumerate(outfit_templates):
        if gender.lower() not in outfit["gender"] and "neutral" not in outfit["gender"]:
            scores[i] *= 0.3
        if not (outfit["age_range"][0] <= age <= outfit["age_range"][1]):
            scores[i] *= 0.5
        if bmi_cat not in outfit["bmi_cats"]:
            scores[i] *= 0.6
        if body_type and "all" not in outfit["body_types"]:
            if body_type not in outfit["body_types"]:
                scores[i] *= 0.7
        if any(occasion.lower() in o.lower() for o in outfit["occasions"]):
            scores[i] *= 1.5

    ranked = sorted(zip(outfit_templates, scores.tolist()), key=lambda x: x[1], reverse=True)
    recommendations = []
    for outfit, score in ranked[:4]:
        recommendations.append({
            "name": outfit["name"],
            "items": outfit["items"],
            "style": outfit["style"],
            "occasions": outfit["occasions"],
            "confidence": round(min(score * 100, 99.5), 1),
            "why": f"Matched your {style_pref} preference for {occasion} as a {gender} aged {age} with {bmi_cat} build."
        })

    return recommendations

def analyze_skin_tone_from_image(image: Image.Image) -> dict:
    img_array = np.array(image.convert("RGB"))
    h, w = img_array.shape[:2]

    center = img_array[h//4: 3*h//4, w//4: 3*w//4]
    pixels = center.reshape(-1, 3).astype(float)

    brightness = pixels.mean(axis=1)
    skin_pixels = pixels[(brightness > 60) & (brightness < 220)]

    if len(skin_pixels) == 0:
        skin_pixels = pixels

    avg_r, avg_g, avg_b = skin_pixels.mean(axis=0)

    warm_score = (avg_r - avg_b) / 255.0
    cool_score = (avg_b - avg_r) / 255.0

    lightness = (avg_r * 0.299 + avg_g * 0.587 + avg_b * 0.114) / 255.0

    if lightness > 0.75:
        depth = "fair"
    elif lightness > 0.5:
        depth = "medium"
    else:
        depth = "dark"

    undertone = "warm" if warm_score > 0.05 else "cool"
    tone_key = f"{depth}_{undertone}"

    palette = SKIN_TONE_PALETTES.get(tone_key, SKIN_TONE_PALETTES["medium_warm"])

    return {
        "detected_tone": tone_key.replace("_", " ").title(),
        "undertone": undertone,
        "depth": depth,
        "rgb_average": [int(avg_r), int(avg_g), int(avg_b)],
        "palette": palette,
        "tone_key": tone_key
    }

def analyze_color_palette_for_tone(tone_key: str) -> dict:
    palette = SKIN_TONE_PALETTES.get(tone_key, SKIN_TONE_PALETTES["medium_warm"])
    return {
        "skin_tone": tone_key.replace("_", " ").title(),
        "description": palette["description"],
        "best_colors": palette["best_colors"],
        "avoid_colors": palette["avoid"],
        "neutral_colors": palette["neutrals"],
        "styling_tip": f"As a {palette['description']}, you glow in {palette['best_colors'][0]} and {palette['best_colors'][1]}. "
                       f"Pair with {palette['neutrals'][0]} for everyday elegance."
    }

app = Flask(__name__)
CORS(app, origins="*")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "online", "device": DEVICE, "models": ["CLIP ViT-L/14", "ViT-base-patch16", "SBERT mpnet"]})

@app.route('/classify', methods=['POST'])
def classify_image():
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"error": "No image provided"}), 400

        img_data = base64.b64decode(data['image'].split(',')[-1])
        image = Image.open(io.BytesIO(img_data)).convert('RGB')
        image = image.resize((224, 224))

        clothing_results = classify_clothing_type(image)
        style_results = classify_style(image)
        occasion_results = classify_occasions(image)
        body_type_results = classify_body_type_suitability(image)
        attributes = extract_garment_attributes(image)

        top_item = clothing_results["top_items"][0][0] if clothing_results["top_items"] else "clothing"
        top_style = list(style_results.keys())[0] if style_results else "casual"
        top_occasion = list(occasion_results.keys())[0] if occasion_results else "everyday"
        top_body_type = list(body_type_results.keys())[0] if body_type_results else "all"

        styling_tip = (
            f"This {attributes['fit']} {top_item} in {list(attributes['colors'].keys())[0]} "
            f"with {attributes['pattern']} pattern embodies a {top_style} aesthetic. "
            f"It's ideal for {top_occasion} and flatters {top_body_type.replace('_', ' ')} body types. "
            f"The {attributes['material']} fabric gives it versatility across seasons."
        )

        return jsonify({
            "success": True,
            "classification": {
                "primary_item": top_item,
                "all_items": clothing_results["top_items"][:5],
                "category": list(clothing_results["categories"].keys())[0],
                "style": style_results,
                "occasions": occasion_results,
                "body_types": body_type_results,
                "attributes": attributes
            },
            "styling_tip": styling_tip,
            "models_used": ["CLIP ViT-L/14", "Sentence-BERT"]
        })

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/recommend', methods=['POST'])
def get_recommendations():
    try:
        data = request.json
        required = ['age', 'gender', 'weight', 'height', 'occasion', 'style']
        for field in required:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        recommendations = recommend_outfits(
            age=int(data['age']),
            gender=data['gender'],
            weight_kg=float(data['weight']),
            height_cm=float(data['height']),
            occasion=data['occasion'],
            style_pref=data['style'],
            body_type=data.get('body_type')
        )

        bmi = float(data['weight']) / ((float(data['height']) / 100) ** 2)
        bmi_cat = bmi_to_body_type_estimate(float(data['weight']), float(data['height']))

        return jsonify({
            "success": True,
            "bmi": round(bmi, 1),
            "bmi_category": bmi_cat,
            "recommendations": recommendations,
            "model_used": "Sentence-BERT + Cosine Similarity"
        })

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/color-analysis', methods=['POST'])
def color_analysis():
    try:
        data = request.json

        if 'image' in data and data['image']:
            img_data = base64.b64decode(data['image'].split(',')[-1])
            image = Image.open(io.BytesIO(img_data)).convert('RGB')
            skin_result = analyze_skin_tone_from_image(image)
            color_rec = analyze_color_palette_for_tone(skin_result['tone_key'])
            return jsonify({"success": True, "skin_analysis": skin_result, "color_recommendations": color_rec})

        elif 'tone_key' in data:
            color_rec = analyze_color_palette_for_tone(data['tone_key'])
            return jsonify({"success": True, "color_recommendations": color_rec})

        else:
            return jsonify({"error": "Provide either image or tone_key"}), 400

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/style-tips', methods=['POST'])
def style_tips():
    try:
        data = request.json
        item = data.get('item', 'outfit')
        body_type = data.get('body_type', 'any')
        occasion = data.get('occasion', 'everyday')

        body_info = BODY_TYPES.get(body_type, {})
        tips = {
            "item": item,
            "body_type": body_type,
            "body_description": body_info.get("description", ""),
            "best_fits": body_info.get("best_fits", []),
            "avoid": body_info.get("avoid", []),
            "occasion_tip": f"For {occasion}, pair your {item} with complementary pieces that elevate the look.",
            "general_tips": [
                "Always ensure the fit is clean and intentional",
                "Layer thoughtfully — each piece should add purpose",
                "Accessories can transform the same outfit across occasions",
                "Color blocking adds visual interest without complexity",
                "Invest in quality basics — they anchor any wardrobe"
            ]
        }
        return jsonify({"success": True, "tips": tips})

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

if __name__ == '__main__':
    NGROK_AUTH_TOKEN = "YOUR_NGROK_AUTH_TOKEN_HERE"

    ngrok.set_auth_token(NGROK_AUTH_TOKEN)
    public_url = ngrok.connect(5000)
    print(f"\n{'='*60}")
    print(f"🚀 FASHION AI BACKEND RUNNING!")
    print(f"🌐 Public URL: {public_url}")
    print(f"📋 Copy this URL into your React app's .env file")
    print(f"   REACT_APP_API_URL={public_url}")
    print(f"{'='*60}\n")

    app.run(port=5000, debug=False, use_reloader=False)