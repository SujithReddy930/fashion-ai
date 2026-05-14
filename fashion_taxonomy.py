COLOURS = ["black", "white", "red", "blue", "green", "yellow", "pink", "purple", "grey", "brown", "orange", "beige", "navy", "cream", "gold", "silver"]
FABRICS = ["cotton", "linen", "silk", "polyester", "denim", "wool", "velvet", "satin", "chiffon", "leather", "knit", "jersey"]
STYLES = ["casual", "formal", "bohemian", "streetwear", "minimalist", "vintage", "romantic", "sporty", "elegant", "trendy"]
OCCASIONS = ["work", "party", "casual outing", "wedding", "beach", "gym", "date night", "brunch", "travel", "festive"]
DRESS_SILHOUETTES = ["A-line dress", "bodycon dress", "wrap dress", "shift dress", "maxi dress"]
TOP_SILHOUETTES = ["crop top", "blouse", "t-shirt", "tank top", "button-down shirt"]
BOTTOM_SILHOUETTES = ["jeans", "trousers", "skirt", "shorts", "leggings"]
OUTERWEAR_SILHOUETTES = ["blazer", "jacket", "coat", "cardigan", "bomber jacket"]
ETHNIC_SILHOUETTES = ["saree", "kurta", "lehenga", "salwar kameez", "sherwani"]
ACTIVEWEAR_SILHOUETTES = ["sports bra", "yoga pants", "tracksuit", "gym shorts", "leggings"]

def generate_all_items():
    items = []
    for colour in COLOURS:
        for fabric in FABRICS:
            for style in STYLES:
                for sil in DRESS_SILHOUETTES + TOP_SILHOUETTES + BOTTOM_SILHOUETTES:
                    items.append(f"{colour} {fabric} {style} {sil}")
    return items

def generate_clip_prompts(items):
    return [f"a photo of {item}" for item in items]

def generate_outfit_archetypes():
    archetypes = []
    for style in STYLES:
        for occasion in OCCASIONS:
            archetypes.append({
                "name": f"{style.title()} {occasion.title()} Look",
                "description": f"A {style} outfit perfect for {occasion}",
                "style": style,
                "occasions": [occasion],
                "gender": ["male", "female", "neutral"],
                "age_range": [18, 60],
                "bmi_range": [15, 40],
                "items": [f"{style} top", f"{style} bottom"],
                "semantic_tags": f"{style} {occasion} fashion outfit"
            })
    return archetypes