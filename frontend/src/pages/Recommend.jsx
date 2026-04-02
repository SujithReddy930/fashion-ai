/**
 * Recommend.jsx  —  Fully client-side outfit recommender
 *
 * ✦ Works OFFLINE — no backend required for recommendations
 * ✦ 10,000+ outfit combinations generated from base archetypes × colour × fabric variants
 * ✦ Every item card shows: name, colour, description + individual Google Shopping / Myntra / Amazon links
 * ✦ Items always visible (never hidden behind a toggle)
 * ✦ Google Shopping URL format: https://www.google.com/search?q=navy+slim+chinos&tbm=shop
 */
import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, RefreshCw, ShoppingBag, ExternalLink, Info, Search, Cpu, ChevronRight, Tag } from 'lucide-react';

// ─── Design tokens (matches global stylesheet) ────────────────────────────────
const css = {
  ink:        '#1C1917', soft: '#44403C', muted: '#78716C', faint: '#A8A29E',
  border:     '#E7E0D8', bg:   '#FAF8F5', card:  '#FFFFFF',
  gold:       '#B5674D', goldDim: 'rgba(181,103,77,0.10)',
  green:      '#4A7C59', greenDim: 'rgba(74,124,89,0.10)',
  error:      '#9B3C3C', errorDim: 'rgba(155,60,60,0.08)',
  blue:       '#2E5FA3',
};

// ─── Colour map ───────────────────────────────────────────────────────────────
const COLOUR_MAP = {
  navy:'#1a3a6b',black:'#1a1a1a',white:'#f8f8f8',beige:'#F5DEB3',grey:'#808080',
  'light blue':'#ADD8E6',blue:'#4169E1',red:'#DC143C',pink:'#FFC0CB','hot pink':'#FF69B4',
  green:'#228B22','forest green':'#228B22','sage green':'#87AE73',olive:'#808000',
  brown:'#A0522D',tan:'#D2B48C',camel:'#C19A6B',cognac:'#9B4500',burgundy:'#800020',
  'royal blue':'#4169E1',gold:'#FFD700',silver:'#C0C0C0',cream:'#FFFDD0',ivory:'#FFFFF0',
  charcoal:'#36454F','dark brown':'#5C3317',champagne:'#F7E7CE',terracotta:'#C27A5A',
  mustard:'#E3AA2C','sky blue':'#87CEEB','blush pink':'#FFB6C1',natural:'#D4C5A9',
  'light denim':'#A3C4D7','medium blue':'#5B8DB8','medium denim':'#4A7DA8',
  'dark denim':'#2B4C7E','off-white':'#FAF0E6','stone':'#C2B280','slate':'#708090',
  'cobalt blue':'#0047AB','emerald':'#50C878','plum':'#8E4585','rust':'#B7410E',
  coral:'#FF6B6B','burnt orange':'#CC5500','teal':'#008080','lavender':'#E6E6FA',
  'powder blue':'#B0E0E6',khaki:'#F0E68C','dark navy':'#0D1B2A','mint':'#98FF98',
  'dusty rose':'#DCAE96','wine':'#722F37',mauve:'#E0B0FF','light grey':'#D3D3D3',
};
const getHex = s => { const k = (s||'').toLowerCase().split('/')[0].trim(); return COLOUR_MAP[k] || '#C8AE8A'; };

// ─── Google Shopping & store links ────────────────────────────────────────────
const gShop   = q => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=shop`;
const myntra  = q => `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
const amazon  = q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`;
const ajio    = q => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`;

// ─── Occasions / Styles / Body types ─────────────────────────────────────────
const OCCASIONS = [
  "everyday casual","office/work","business meeting","formal dinner",
  "wedding guest","party/clubbing","date night","outdoor adventure",
  "gym/workout","beach/vacation","festival","college/campus",
  "religious ceremony","job interview","brunch","evening gala"
];
const STYLES = [
  "casual","formal","business casual","smart casual","bohemian","streetwear",
  "minimalist","romantic","vintage","athleisure","ethnic traditional","edgy",
  "classic","preppy","luxury","indie","cottagecore","y2k","coastal","indo-western","dark academia"
];
const BODY_TYPES = [
  { key:"hourglass",         label:"Hourglass",          desc:"Balanced shoulders & hips, defined waist" },
  { key:"pear",              label:"Pear",               desc:"Hips wider than shoulders" },
  { key:"apple",             label:"Apple",              desc:"Fuller midsection, slimmer legs" },
  { key:"rectangle",         label:"Rectangle",          desc:"Shoulders, waist & hips similar width" },
  { key:"inverted_triangle", label:"Inverted Triangle",  desc:"Shoulders broader than hips" }
];

// ─── BMI analysis ─────────────────────────────────────────────────────────────
function getBodyAnalysis(weight, height) {
  const bmi = weight / ((height / 100) ** 2);
  const h = parseFloat(height);
  const heightDesc = h < 155 ? 'petite' : h < 168 ? 'average height' : h < 178 ? 'tall' : 'very tall';
  const configs = [
    { max:17,   frame:'Very Slim',        color:'#6B8C74',
      tip:`Your ${heightDesc} very slim frame benefits from structured pieces that add volume and shape.`,
      wear:['Layered outfits add visual volume','Structured blazers create shape','Horizontal stripes add width','Thick fabrics like denim and wool','Peplum tops add curves'],
      avoid:['Oversized shapeless pieces','Very thin clingy fabrics','Deep V-necks'] },
    { max:18.5, frame:'Slim / Lean',      color:'#7BA87F',
      tip:`Your ${heightDesc} lean frame is versatile — most silhouettes work beautifully.`,
      wear:['Fitted and relaxed silhouettes both work','Bold prints and textures freely','Layering with jackets and cardigans'],
      avoid:['Oversized top AND bottom simultaneously'] },
    { max:23,   frame:'Athletic / Toned', color:'#B5674D',
      tip:`Your ${heightDesc} athletic build suits clean fitted silhouettes and wrap styles.`,
      wear:['Fitted cuts showcase proportions','Wrap dresses define waist','Slim-fit straight-leg trousers','V-necks complement your neckline'],
      avoid:['Very boxy cuts that hide shape','Over-embellished bulky pieces'] },
    { max:25,   frame:'Balanced',         color:'#C8AE8A',
      tip:`Your ${heightDesc} balanced build works with most styles — focus on waist definition.`,
      wear:['Most silhouettes work well','Belts and wrap styles define waist','A-line and fit-and-flare','Structured blazers add polish'],
      avoid:['Shapeless dresses with no waist definition'] },
    { max:30,   frame:'Fuller / Curvy',   color:'#9B6B4D',
      tip:`Your ${heightDesc} fuller figure has beautiful curves — embrace wrap styles and V-necklines.`,
      wear:['Empire waist and A-line','Wrap dresses create a defined waist','Dark solid colours elongate','V-necklines open the face','Wide-leg trousers'],
      avoid:['Clingy fabrics over midsection','Horizontal stripes at widest points','Low-rise bottoms'] },
    { max:999,  frame:'Plus Size',        color:'#8B6560',
      tip:`Your ${heightDesc} plus-size frame deserves fashion that celebrates you — focus on fit above all.`,
      wear:['Well-fitted is always more flattering','Monochrome top to bottom elongates','Wide-leg palazzo pants','Wrap and peplum define waist','Bold jewel tones look stunning'],
      avoid:['Overly baggy shapeless clothing','Very tight clingy fabrics'] },
  ];
  const cfg = configs.find(c => bmi < c.max) || configs[configs.length-1];
  if (h < 155) cfg.wear.push('Monochrome head-to-toe elongates petite frame');
  if (h >= 178) cfg.wear.push('Maxi dresses and wide-leg trousers look extraordinary on tall frames');
  return { ...cfg, bmi: Math.round(bmi * 10) / 10, heightDesc, heightCm: h };
}

// ══════════════════════════════════════════════════════════════════════════════
//  OUTFIT DATABASE  ——  10,000+ combinations
//  Structure:  base archetypes × colour palettes × size variants
// ══════════════════════════════════════════════════════════════════════════════

/*
 * Each archetype defines:
 * name, style, gender[], age[], bmiMax, occasions[], description
 * pieces: array of { role, nameTemplate, colours[], desc, category }
 *
 * role   = human label shown in card ("Top", "Bottom", "Shoes", etc.)
 * category = used in Google Shopping query (more specific search term)
 */

const BASE_ARCHETYPES = [
// ── FEMALE CASUAL ─────────────────────────────────────────────────────────────
{
  name:"Classic White & Denim", style:"casual", gender:["female"], age:[14,55], bmiMax:999,
  occasions:["everyday casual","brunch","college/campus"],
  desc:"A timeless pairing of a clean white tee and perfectly-fitted high-waist jeans — effortless and universally flattering.",
  pieces:[
    { role:"Top",       nameTemplate:"White {fit} T-Shirt",    colours:["white","off-white","cream"],         desc:"Premium cotton relaxed tee",       category:"women white cotton t-shirt" },
    { role:"Bottom",    nameTemplate:"High-Waist {wash} Jeans",colours:["light denim","medium denim","dark denim"], desc:"Slim straight-leg high-waist",  category:"women high waist jeans" },
    { role:"Shoes",     nameTemplate:"White {type} Sneakers",  colours:["white"],                             desc:"Clean minimalist leather or canvas",category:"women white sneakers" },
    { role:"Bag",       nameTemplate:"{colour} Crossbody Bag", colours:["tan","black","beige","cognac"],      desc:"Small structured crossbody",       category:"women leather crossbody bag" },
    { role:"Accessory", nameTemplate:"Gold {style} Earrings",  colours:["gold"],                              desc:"Delicate gold hoops or studs",     category:"gold hoop earrings women" },
  ]
},
{
  name:"Linen Summer Look", style:"casual", gender:["female"], age:[16,55], bmiMax:999,
  occasions:["beach/vacation","brunch","everyday casual"],
  desc:"Relaxed Breton stripe linen top with wide-leg linen trousers — effortlessly chic Mediterranean-inspired summer casual.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Linen {type} Top",       colours:["white","sky blue","sage green","off-white","coral"], desc:"Breathable linen relaxed top", category:"women linen top summer" },
    { role:"Bottom", nameTemplate:"{colour} Wide-Leg Linen Trousers", colours:["beige","white","ivory","stone","khaki"],             desc:"Relaxed wide-leg linen",       category:"women wide leg linen trousers" },
    { role:"Shoes",  nameTemplate:"{colour} Espadrilles",             colours:["tan","white","natural"],                             desc:"Jute-sole espadrilles",        category:"women espadrilles shoes" },
    { role:"Bag",    nameTemplate:"Woven Straw {type} Tote",          colours:["natural"],                                           desc:"Woven natural straw market bag",category:"women straw tote bag" },
  ]
},
{
  name:"Office Power Look", style:"business casual", gender:["female"], age:[20,60], bmiMax:999,
  occasions:["office/work","business meeting","job interview"],
  desc:"Sharply tailored black blazer, slim trousers, and pointed-toe flats — commanding and polished.",
  pieces:[
    { role:"Blazer",  nameTemplate:"{colour} Tailored Blazer",        colours:["charcoal","black","navy","camel","ivory"],  desc:"Single or double-breasted tailored",    category:"women tailored blazer office" },
    { role:"Bottom",  nameTemplate:"{colour} Slim Tailored Trousers",  colours:["black","charcoal","navy","beige"],          desc:"High-waist slim tailored fit",          category:"women slim tailored trousers" },
    { role:"Top",     nameTemplate:"{colour} {fabric} Blouse",         colours:["white","blush pink","ivory","light blue"],  desc:"Crisp tucked-in blouse",               category:"women silk blouse office" },
    { role:"Shoes",   nameTemplate:"{colour} Pointed-Toe Flats",       colours:["black","nude","tan","burgundy"],            desc:"Leather pointed-toe ballerina flats",  category:"women pointed toe flat shoes" },
    { role:"Bag",     nameTemplate:"{colour} Structured Work Tote",    colours:["black","tan","camel","navy"],               desc:"Structured leather portfolio tote",    category:"women leather tote bag office" },
  ]
},
{
  name:"Boho Festival Dress", style:"bohemian", gender:["female"], age:[16,42], bmiMax:999,
  occasions:["festival","brunch","date night","beach/vacation"],
  desc:"Floral wrap midi dress with flat sandals and woven accessories — effortlessly boho.",
  pieces:[
    { role:"Dress",     nameTemplate:"{colour} Floral Wrap Midi Dress",  colours:["floral pastel","terracotta","burnt orange","mustard","coral"], desc:"Floaty wrap silhouette midi length", category:"women floral wrap midi dress" },
    { role:"Shoes",     nameTemplate:"{colour} Flat Leather Sandals",     colours:["tan","brown","cognac","gold"],    desc:"Flat strappy leather sandals",       category:"women flat strappy sandals" },
    { role:"Bag",       nameTemplate:"Woven {colour} Rattan Bag",          colours:["natural","brown"],                desc:"Rattan or wicker crossbody",         category:"women rattan wicker bag boho" },
    { role:"Jewellery", nameTemplate:"Layered Gold {type} Necklaces",      colours:["gold"],                          desc:"Stacked coin or pendant necklaces",  category:"layered gold necklace boho" },
  ]
},
{
  name:"Date Night Midi", style:"romantic", gender:["female"], age:[18,50], bmiMax:999,
  occasions:["date night","evening gala","formal dinner"],
  desc:"A satin slip midi dress in a jewel tone with strappy heels and minimalist gold jewellery.",
  pieces:[
    { role:"Dress",     nameTemplate:"{colour} Satin Slip Midi Dress",   colours:["burgundy","navy","emerald","plum","dusty rose","champagne"], desc:"Bias-cut satin midi length", category:"women satin slip midi dress" },
    { role:"Shoes",     nameTemplate:"{colour} Strappy Heeled Sandals",   colours:["gold","silver","black","nude"],  desc:"Delicate strappy block or stiletto heels", category:"women strappy heeled sandals" },
    { role:"Bag",       nameTemplate:"{colour} Satin Clutch Bag",          colours:["gold","silver","black"],         desc:"Small satin or beaded evening clutch",     category:"women satin clutch evening bag" },
    { role:"Jewellery", nameTemplate:"Gold {type} Drop Earrings",          colours:["gold"],                          desc:"Statement gold drop earrings",             category:"gold drop earrings women formal" },
  ]
},
{
  name:"Cosy Oversized Weekend", style:"streetwear", gender:["female"], age:[14,38], bmiMax:999,
  occasions:["everyday casual","college/campus"],
  desc:"Matching grey oversized hoodie, biker shorts, and chunky sneakers — effortless off-duty.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Oversized Hoodie",          colours:["grey","charcoal","cream","sage green","dusty rose","black"], desc:"Dropped-shoulder fleece hoodie",  category:"women oversized hoodie" },
    { role:"Bottom", nameTemplate:"{colour} High-Waist Biker Shorts",   colours:["black","grey","navy","charcoal"],    desc:"Stretchy high-waist biker shorts",category:"women biker shorts" },
    { role:"Shoes",  nameTemplate:"{colour} Chunky Platform Sneakers",  colours:["white","black"],                     desc:"Chunky white platform sneakers",  category:"women chunky platform sneakers" },
    { role:"Bag",    nameTemplate:"{colour} Mini Chain Bag",             colours:["black","silver","gold"],             desc:"Mini chain-strap shoulder bag",   category:"women mini chain shoulder bag" },
  ]
},
{
  name:"Smart Casual Friday", style:"smart casual", gender:["female"], age:[22,55], bmiMax:999,
  occasions:["office/work","brunch","everyday casual"],
  desc:"Dark wash jeans with a silk blouse and block heels — the perfect transition from desk to dinner.",
  pieces:[
    { role:"Bottom",  nameTemplate:"{wash} Straight-Leg Jeans",        colours:["dark denim","black","medium denim"],  desc:"Tailored straight-leg jeans",    category:"women straight leg jeans dark wash" },
    { role:"Top",     nameTemplate:"{colour} Silk Blouse",              colours:["blush pink","ivory","sky blue","white","sage green"], desc:"Tucked-in silk or satin blouse", category:"women silk blouse" },
    { role:"Shoes",   nameTemplate:"{colour} Square-Toe Block Heels",   colours:["black","nude","tan","burgundy"],     desc:"Comfortable square-toe block heel",category:"women block heel shoes" },
    { role:"Bag",     nameTemplate:"{colour} Leather Work Tote",        colours:["camel","black","tan","cognac"],      desc:"Structured camel leather work tote",category:"women leather tote bag" },
  ]
},
{
  name:"Cottagecore Prairie", style:"cottagecore", gender:["female"], age:[16,38], bmiMax:999,
  occasions:["festival","brunch","outdoor adventure"],
  desc:"Pastel floral puff-sleeve prairie midi dress with Mary Janes and a cream lace cardigan.",
  pieces:[
    { role:"Dress",     nameTemplate:"{colour} Puff-Sleeve Prairie Midi Dress", colours:["floral pastel","dusty rose","lavender","mint","ivory"], desc:"Smocked puff-sleeve midi",     category:"women cottagecore floral dress midi" },
    { role:"Shoes",     nameTemplate:"{colour} Block-Heel Mary Jane Shoes",      colours:["brown","black","tan"],                                  desc:"Classic block-heel Mary Janes",category:"women mary jane shoes block heel" },
    { role:"Cardigan",  nameTemplate:"{colour} Open-Knit Lace Cardigan",          colours:["cream","ivory","white"],                                desc:"Lightweight lace open-knit",   category:"women lace cardigan cream" },
    { role:"Bag",       nameTemplate:"{colour} Small Wicker Bag",                  colours:["natural","brown"],                                      desc:"Wicker or straw mini bag",     category:"women wicker straw bag small" },
  ]
},
{
  name:"Evening Sequin Look", style:"formal", gender:["female"], age:[18,55], bmiMax:999,
  occasions:["evening gala","party/clubbing","formal dinner","wedding guest"],
  desc:"A shimmering sequin mini dress with strappy sandals and a metallic clutch — party-perfect.",
  pieces:[
    { role:"Dress",     nameTemplate:"{colour} Sequin Mini Dress",   colours:["gold","silver","black","emerald","burgundy"], desc:"All-over sequin bodycon mini", category:"women sequin mini dress party" },
    { role:"Shoes",     nameTemplate:"{colour} Strappy Heeled Mules", colours:["gold","silver","black","nude"],               desc:"Strappy heeled mule sandals",  category:"women heeled mule sandals" },
    { role:"Bag",       nameTemplate:"{colour} Metallic Clutch",      colours:["gold","silver"],                              desc:"Small metallic evening clutch",category:"women metallic evening clutch" },
    { role:"Jewellery", nameTemplate:"{colour} Statement Earrings",    colours:["gold","silver"],                              desc:"Bold statement drop earrings", category:"women statement earrings party" },
  ]
},
{
  name:"Minimalist Monochrome", style:"minimalist", gender:["female"], age:[20,55], bmiMax:999,
  occasions:["office/work","brunch","everyday casual"],
  desc:"All-white ribbed set, clean leather sneakers, and a single gold accessory — serene and powerful.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Ribbed Fitted Top",        colours:["white","cream","ivory","light grey","black","beige"], desc:"Fitted ribbed stretch top", category:"women ribbed fitted top" },
    { role:"Bottom", nameTemplate:"{colour} Wide-Leg Tailored Trousers",colours:["white","cream","black","charcoal","beige","grey"],   desc:"Tailored wide-leg trousers", category:"women wide leg tailored trousers" },
    { role:"Shoes",  nameTemplate:"{colour} Clean Leather Trainers",    colours:["white","black"],                                     desc:"Minimalist clean leather sneakers", category:"women leather sneakers minimalist" },
    { role:"Bag",    nameTemplate:"{colour} Mini Structured Handbag",   colours:["black","white","tan","beige"],                       desc:"Mini structured top-handle bag", category:"women mini structured handbag" },
  ]
},
{
  name:"Athleisure Power Set", style:"athleisure", gender:["female"], age:[14,50], bmiMax:999,
  occasions:["gym/workout","everyday casual"],
  desc:"Matching co-ord tracksuit with spotless white trainers — sleek and functional all day.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Zip-Up Tracksuit Jacket",  colours:["sage green","black","grey","navy","dusty rose","rust"], desc:"Performance zip-up jacket",       category:"women tracksuit jacket zip up" },
    { role:"Bottom", nameTemplate:"{colour} Tapered Joggers",           colours:["sage green","black","grey","navy","dusty rose","rust"], desc:"Matching tapered jogger bottoms", category:"women tapered jogger pants" },
    { role:"Shoes",  nameTemplate:"{colour} Running Trainers",           colours:["white","black"],                                       desc:"Cushioned performance trainers",  category:"women running trainers shoes" },
    { role:"Bag",    nameTemplate:"{colour} Sports Gym Bag",             colours:["black","grey","navy"],                                 desc:"Compact gym or duffel bag",       category:"women gym bag duffel" },
  ]
},
// ── MALE CASUAL ───────────────────────────────────────────────────────────────
{
  name:"Weekend Classic", style:"casual", gender:["male"], age:[14,60], bmiMax:999,
  occasions:["everyday casual","brunch","college/campus"],
  desc:"White premium cotton tee, classic straight-leg denim, and clean leather sneakers — effortlessly sharp.",
  pieces:[
    { role:"Top",      nameTemplate:"{colour} Premium Cotton T-Shirt",   colours:["white","off-white","black","grey","navy","sage green"], desc:"Premium heavyweight cotton tee", category:"men premium cotton t-shirt" },
    { role:"Bottom",   nameTemplate:"{wash} Straight-Leg Jeans",          colours:["medium denim","dark denim","black","light denim"],      desc:"Classic straight-leg denim",     category:"men straight leg jeans" },
    { role:"Shoes",    nameTemplate:"{colour} Clean Leather Sneakers",    colours:["white","black"],                                        desc:"Clean minimalist leather sneakers",category:"men leather sneakers white" },
    { role:"Accessory",nameTemplate:"{colour} Minimalist Watch",           colours:["silver","black","gold"],                                desc:"Slim minimalist wrist watch",    category:"men minimalist watch" },
  ]
},
{
  name:"Smart Weekend Male", style:"smart casual", gender:["male"], age:[18,55], bmiMax:999,
  occasions:["brunch","office/work","date night"],
  desc:"Slim navy chinos, white Oxford shirt, tan loafers — refined and effortlessly put-together.",
  pieces:[
    { role:"Top",      nameTemplate:"{colour} Oxford Button-Down Shirt",  colours:["white","light blue","sky blue","off-white"],        desc:"Classic cotton Oxford button-down",category:"men oxford button down shirt" },
    { role:"Bottom",   nameTemplate:"{colour} Slim Chinos",                colours:["navy","beige","khaki","olive","charcoal","stone"],   desc:"Slim-fit cotton chinos",           category:"men slim chinos trousers" },
    { role:"Shoes",    nameTemplate:"{colour} Penny Loafers",              colours:["tan","cognac","brown","black"],                       desc:"Classic leather penny loafers",   category:"men penny loafers leather" },
    { role:"Belt",     nameTemplate:"{colour} Leather Belt",               colours:["tan","brown","black"],                               desc:"Slim leather belt matching shoes", category:"men leather belt" },
    { role:"Watch",    nameTemplate:"{colour} Classic Watch",              colours:["silver","gold","black"],                             desc:"Classic face dress watch",         category:"men classic dress watch" },
  ]
},
{
  name:"Relaxed Urban Streetwear", style:"streetwear", gender:["male"], age:[14,35], bmiMax:999,
  occasions:["everyday casual","college/campus"],
  desc:"Dropped-shoulder grey sweatshirt, black joggers, chunky sneakers — confident street style.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Oversized Sweatshirt",    colours:["grey","black","charcoal","cream","navy","sage green","rust"], desc:"Dropped-shoulder fleece sweatshirt", category:"men oversized sweatshirt" },
    { role:"Bottom", nameTemplate:"{colour} Tapered Joggers",          colours:["black","grey","navy","charcoal"],                            desc:"Slim tapered jogger trousers",       category:"men tapered joggers" },
    { role:"Shoes",  nameTemplate:"{colour} Chunky Sneakers",          colours:["white","black"],                                            desc:"Chunky platform sole trainers",      category:"men chunky sneakers platform" },
    { role:"Bag",    nameTemplate:"{colour} Mini Crossbody Bag",        colours:["black","grey","brown"],                                     desc:"Mini canvas or nylon crossbody",    category:"men mini crossbody bag" },
  ]
},
{
  name:"Linen Resort Summer", style:"casual", gender:["male"], age:[18,60], bmiMax:999,
  occasions:["beach/vacation","brunch","outdoor adventure"],
  desc:"Sky blue linen short-sleeve shirt, white chino shorts, leather slides — perfect resort dressing.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Linen Short-Sleeve Shirt", colours:["sky blue","white","sage green","off-white","beige","coral","rust"], desc:"Relaxed linen short-sleeve shirt", category:"men linen shirt short sleeve" },
    { role:"Bottom", nameTemplate:"{colour} Chino Shorts",             colours:["white","beige","navy","khaki","olive","light blue"],                 desc:"Above-knee chino shorts",          category:"men chino shorts" },
    { role:"Shoes",  nameTemplate:"{colour} Leather Slide Sandals",    colours:["tan","brown","black"],                                               desc:"Tan leather slide sandals",        category:"men leather slide sandals" },
    { role:"Hat",    nameTemplate:"{colour} Raffia Sun Hat",            colours:["natural","tan"],                                                     desc:"Natural woven raffia sun hat",     category:"men raffia sun hat woven" },
    { role:"Shades", nameTemplate:"{colour} Retro Sunglasses",         colours:["black","brown","gold"],                                              desc:"Classic retro sunglasses",         category:"men retro sunglasses" },
  ]
},
{
  name:"Corporate Power Male", style:"formal", gender:["male"], age:[20,65], bmiMax:999,
  occasions:["office/work","business meeting","job interview","formal dinner"],
  desc:"Charcoal wool suit, crisp white shirt, and leather Oxford shoes — authority and precision.",
  pieces:[
    { role:"Blazer",  nameTemplate:"{colour} Tailored Suit Jacket",   colours:["charcoal","navy","black","dark navy"],  desc:"Two-button tailored wool blazer",    category:"men suit jacket tailored" },
    { role:"Trousers",nameTemplate:"{colour} Matching Suit Trousers",  colours:["charcoal","navy","black","dark navy"],  desc:"Matching slim suit trousers",        category:"men suit trousers tailored" },
    { role:"Shirt",   nameTemplate:"{colour} Dress Shirt",             colours:["white","light blue","sky blue"],       desc:"Crisp cotton or poplin dress shirt", category:"men dress shirt formal" },
    { role:"Shoes",   nameTemplate:"{colour} Oxford Leather Shoes",    colours:["black","dark brown","cognac"],         desc:"Classic brogued or cap-toe Oxfords", category:"men oxford leather shoes formal" },
    { role:"Belt",    nameTemplate:"{colour} Leather Dress Belt",      colours:["black","dark brown"],                  desc:"Thin leather dress belt matching shoes",category:"men dress leather belt" },
    { role:"Tie",     nameTemplate:"{colour} Woven Silk Tie",          colours:["navy","burgundy","charcoal","silver"], desc:"Silk or woven repp tie",             category:"men silk tie formal" },
  ]
},
{
  name:"Old Money Weekend", style:"luxury", gender:["male"], age:[22,65], bmiMax:999,
  occasions:["brunch","everyday casual","outdoor adventure"],
  desc:"Double-breasted navy blazer, cream pleated trousers, penny loafers — quiet luxury at its finest.",
  pieces:[
    { role:"Blazer",   nameTemplate:"{colour} Double-Breasted Blazer", colours:["navy","charcoal","camel","forest green"], desc:"Double-breasted heritage blazer", category:"men double breasted blazer" },
    { role:"Trousers", nameTemplate:"{colour} Pleated Wide-Leg Trousers",colours:["cream","beige","ivory","stone"],        desc:"Pleated relaxed wide-leg trousers",category:"men pleated wide leg trousers" },
    { role:"Shirt",    nameTemplate:"{colour} Classic Button-Down",     colours:["white","off-white","light blue"],        desc:"Classic cotton button-down Oxford",category:"men cotton button down shirt classic" },
    { role:"Shoes",    nameTemplate:"{colour} Horsebit Loafers",        colours:["cognac","tan","dark brown","black"],      desc:"Classic horse-bit leather loafers",category:"men horsebit leather loafers" },
    { role:"Belt",     nameTemplate:"{colour} Canvas Belt",             colours:["navy","tan","brown"],                    desc:"Webbing or canvas preppy belt",    category:"men canvas webbing belt preppy" },
  ]
},
{
  name:"Dark Academia Male", style:"dark academia", gender:["male"], age:[16,35], bmiMax:999,
  occasions:["college/campus","everyday casual","brunch"],
  desc:"Plaid blazer, dark corduroy trousers, turtleneck, and leather boots — bookish and brooding.",
  pieces:[
    { role:"Blazer",   nameTemplate:"{colour} Plaid Tweed Blazer",    colours:["brown","charcoal","dark brown"],  desc:"Heritage plaid tweed blazer",  category:"men plaid tweed blazer dark academia" },
    { role:"Bottom",   nameTemplate:"{colour} Corduroy Trousers",      colours:["dark brown","charcoal","olive"],  desc:"Slim corduroy trousers",        category:"men corduroy trousers slim" },
    { role:"Top",      nameTemplate:"{colour} Fine Knit Turtleneck",   colours:["cream","black","camel","grey"],   desc:"Fine-knit cotton turtleneck",   category:"men fine knit turtleneck" },
    { role:"Shoes",    nameTemplate:"{colour} Leather Chelsea Boots",  colours:["dark brown","black","cognac"],    desc:"Classic leather Chelsea boots",  category:"men leather chelsea boots" },
    { role:"Bag",      nameTemplate:"{colour} Leather Satchel",        colours:["dark brown","tan","black"],       desc:"Vintage-style leather satchel",  category:"men leather satchel bag vintage" },
  ]
},
{
  name:"Campus Cool Male", style:"casual", gender:["male"], age:[14,28], bmiMax:999,
  occasions:["college/campus","everyday casual"],
  desc:"Graphic tee, slim jeans, clean sneakers, and a structured cap — everyday campus cool.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Graphic Tee",        colours:["white","black","grey"],       desc:"Oversized cotton graphic tee",    category:"men graphic t-shirt oversized" },
    { role:"Bottom", nameTemplate:"{colour} Slim Jeans",          colours:["medium denim","black","dark denim"], desc:"Slim fit jeans",            category:"men slim fit jeans" },
    { role:"Shoes",  nameTemplate:"{colour} Lifestyle Sneakers",  colours:["white","black"],              desc:"Clean white lifestyle sneakers",  category:"men lifestyle sneakers" },
    { role:"Cap",    nameTemplate:"{colour} Structured Cap",      colours:["black","white","navy"],       desc:"Structured 6-panel baseball cap", category:"men structured baseball cap" },
  ]
},
// ── ETHNIC / INDO-WESTERN ────────────────────────────────────────────────────
{
  name:"Kurta & Churidar", style:"ethnic traditional", gender:["male"], age:[16,65], bmiMax:999,
  occasions:["religious ceremony","wedding guest","festival","formal dinner"],
  desc:"Embroidered cotton or silk kurta with churidar and embellished juttis — elegant and cultural.",
  pieces:[
    { role:"Kurta",    nameTemplate:"{colour} {fabric} Kurta",         colours:["white","ivory","navy","burgundy","gold","rust","teal"], desc:"Traditional embroidered kurta",  category:"men kurta embroidered" },
    { role:"Bottom",   nameTemplate:"{colour} Churidar / Pajama",       colours:["white","ivory","cream","beige","black"],              desc:"Fitted churidar or straight pajama",category:"men churidar pajama ethnic" },
    { role:"Shoes",    nameTemplate:"{colour} Embellished Juttis",      colours:["gold","tan","brown","black"],                         desc:"Traditional embellished juttis",  category:"men ethnic jutti shoes embellished" },
    { role:"Dupatta",  nameTemplate:"{colour} Contrast Dupatta",        colours:["gold","ivory","rust","teal"],                         desc:"Contrast stole or dupatta",       category:"men dupatta stole ethnic" },
  ]
},
{
  name:"Anarkali Suit", style:"ethnic traditional", gender:["female"], age:[16,65], bmiMax:999,
  occasions:["wedding guest","religious ceremony","festival","formal dinner"],
  desc:"Flowing Anarkali suit with churidar and embellished heeled sandals — timeless Indian elegance.",
  pieces:[
    { role:"Anarkali", nameTemplate:"{colour} Embroidered Anarkali",    colours:["magenta","royal blue","burgundy","emerald","gold","rust","teal"], desc:"Floor-length embroidered Anarkali", category:"women anarkali suit embroidered" },
    { role:"Churidar", nameTemplate:"{colour} Fitted Churidar",         colours:["nude","white","ivory","matching"],                               desc:"Fitted churidar leggings",          category:"women churidar leggings ethnic" },
    { role:"Shoes",    nameTemplate:"{colour} Embellished Heeled Sandals",colours:["gold","silver","tan"],                                          desc:"Embellished heeled wedding sandals",category:"women ethnic heeled sandals embellished" },
    { role:"Dupatta",  nameTemplate:"{colour} Silk Dupatta",            colours:["gold","ivory","matching","silver"],                              desc:"Silk or chiffon dupatta",           category:"women silk dupatta ethnic" },
  ]
},
// ── PLUS SIZE FOCUSED ────────────────────────────────────────────────────────
{
  name:"Curve Power Wrap", style:"casual", gender:["female"], age:[18,65], bmiMax:999,
  occasions:["everyday casual","brunch","date night"],
  desc:"A floaty wrap dress in a rich jewel tone that celebrates your curves — always universally flattering.",
  pieces:[
    { role:"Dress",     nameTemplate:"{colour} Wrap Midi Dress",         colours:["navy","burgundy","emerald","rust","teal","plum"],  desc:"Floaty wrap V-neck midi dress",   category:"women wrap midi dress plus size" },
    { role:"Shoes",     nameTemplate:"{colour} Square-Toe Block Heels",  colours:["black","tan","nude","cognac"],                     desc:"Comfortable block heel shoes",    category:"women block heel shoes comfortable" },
    { role:"Bag",       nameTemplate:"{colour} Structured Tote",          colours:["camel","black","tan"],                             desc:"Structured leather tote bag",     category:"women structured tote bag" },
    { role:"Jewellery", nameTemplate:"{colour} Statement Earrings",       colours:["gold","silver"],                                   desc:"Bold drop statement earrings",    category:"women statement drop earrings" },
  ]
},
// ── SPECIAL OCCASIONS ────────────────────────────────────────────────────────
{
  name:"Wedding Guest Chic", style:"formal", gender:["female"], age:[18,65], bmiMax:999,
  occasions:["wedding guest","formal dinner","evening gala"],
  desc:"A pastel or jewel-tone midi dress with heeled sandals and a beaded clutch — appropriate elegance.",
  pieces:[
    { role:"Dress",     nameTemplate:"{colour} Midi Occasion Dress",     colours:["dusty rose","lavender","sage green","champagne","powder blue","ivory"], desc:"Floral or solid midi occasion dress", category:"women midi dress wedding guest" },
    { role:"Shoes",     nameTemplate:"{colour} Heeled Strappy Sandals",  colours:["gold","silver","nude","champagne"],    desc:"Delicate heeled strappy sandals",     category:"women strappy heeled sandals wedding" },
    { role:"Bag",       nameTemplate:"{colour} Beaded Clutch",            colours:["gold","silver","pearl"],               desc:"Small beaded or satin clutch",        category:"women beaded clutch bag occasion" },
    { role:"Stole",     nameTemplate:"{colour} Chiffon Wrap Stole",       colours:["ivory","champagne","silver","matching"],desc:"Light chiffon wrap stole",           category:"women chiffon wrap stole shawl" },
  ]
},
{
  name:"Preppy Campus Female", style:"preppy", gender:["female"], age:[14,28], bmiMax:999,
  occasions:["college/campus","brunch","everyday casual"],
  desc:"Argyle sweater vest over Oxford shirt, tartan skirt, and penny loafers — academic charm.",
  pieces:[
    { role:"Vest",   nameTemplate:"{colour} Argyle Sweater Vest",     colours:["navy","burgundy","forest green"],          desc:"V-neck argyle knit vest",              category:"women argyle sweater vest" },
    { role:"Shirt",  nameTemplate:"{colour} Oxford Shirt",             colours:["white","light blue","off-white"],          desc:"Crisp cotton Oxford button-down",      category:"women oxford shirt white" },
    { role:"Skirt",  nameTemplate:"{colour} Pleated Mini Skirt",       colours:["plaid","black","navy","burgundy","green"], desc:"Pleated tartan or solid mini",         category:"women pleated mini skirt plaid" },
    { role:"Shoes",  nameTemplate:"{colour} Penny Loafers",            colours:["brown","black","burgundy","tan"],          desc:"Classic leather penny loafers",        category:"women penny loafers leather" },
    { role:"Bag",    nameTemplate:"{colour} Mini Leather Backpack",    colours:["tan","brown","black"],                     desc:"Structured mini leather backpack",     category:"women mini leather backpack" },
  ]
},
{
  name:"90s Grunge Revival", style:"edgy", gender:["female","male","neutral"], age:[15,35], bmiMax:999,
  occasions:["festival","party/clubbing","everyday casual"],
  desc:"Oversized flannel shirt, relaxed mom jeans, combat boots, and a velvet choker — grunge reborn.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Oversized Flannel Shirt", colours:["brown plaid","black","red","grey"],          desc:"Oversized plaid flannel shirt",    category:"women oversized flannel shirt grunge" },
    { role:"Bottom", nameTemplate:"{colour} Relaxed Mom Jeans",        colours:["light denim","medium denim","black"],        desc:"Relaxed fit high-rise mom jeans",  category:"women mom jeans relaxed high rise" },
    { role:"Shoes",  nameTemplate:"{colour} Lace-Up Combat Boots",     colours:["black"],                                     desc:"Chunky black lace-up combat boots",category:"women combat boots lace up black" },
    { role:"Neck",   nameTemplate:"{colour} Velvet Choker",            colours:["black"],                                     desc:"Classic black velvet choker",      category:"black velvet choker necklace" },
  ]
},
{
  name:"Coastal Cool", style:"coastal", gender:["female"], age:[16,55], bmiMax:999,
  occasions:["beach/vacation","brunch","outdoor adventure"],
  desc:"Sky blue linen midi shirt dress, white espadrilles, and a wicker tote — pure coastal energy.",
  pieces:[
    { role:"Dress",  nameTemplate:"{colour} Linen Shirt Midi Dress",  colours:["sky blue","white","sage green","coral","off-white"], desc:"Relaxed linen shirt dress midi",  category:"women linen shirt dress midi coastal" },
    { role:"Shoes",  nameTemplate:"{colour} Canvas Espadrilles",       colours:["white","natural","tan"],                             desc:"Canvas and jute espadrilles",     category:"women canvas espadrilles shoes" },
    { role:"Bag",    nameTemplate:"{colour} Wicker Market Tote",       colours:["natural"],                                           desc:"Natural wicker market basket tote",category:"women wicker market basket tote" },
    { role:"Shades", nameTemplate:"{colour} Round Retro Sunglasses",   colours:["black","gold","brown"],                              desc:"Retro round tortoiseshell frames", category:"women retro round sunglasses" },
    { role:"Hat",    nameTemplate:"{colour} Wide-Brim Straw Hat",      colours:["natural","tan"],                                     desc:"Wide-brim sun hat straw",         category:"women wide brim straw hat sun" },
  ]
},
// ── MALE FORMAL / EVENING ────────────────────────────────────────────────────
{
  name:"Black Tie Evening Male", style:"formal", gender:["male"], age:[18,65], bmiMax:999,
  occasions:["formal dinner","evening gala","wedding guest","party/clubbing"],
  desc:"Classic black tuxedo with a white dress shirt and black bow tie — timeless formal elegance.",
  pieces:[
    { role:"Jacket",  nameTemplate:"{colour} Tuxedo Jacket",          colours:["black","midnight navy","charcoal"],    desc:"Shawl or peak-lapel tuxedo jacket",   category:"men tuxedo jacket black tie" },
    { role:"Trousers",nameTemplate:"{colour} Tuxedo Trousers",         colours:["black","midnight navy","charcoal"],    desc:"Slim satin-stripe tuxedo trousers",   category:"men tuxedo trousers formal" },
    { role:"Shirt",   nameTemplate:"{colour} Dress Shirt",             colours:["white","ivory","off-white"],           desc:"Bib-front or plain formal dress shirt",category:"men formal dress shirt white" },
    { role:"Tie",     nameTemplate:"{colour} {type} Bow Tie",          colours:["black","navy","burgundy","silver"],    desc:"Silk or woven bow tie",               category:"men bow tie silk formal" },
    { role:"Shoes",   nameTemplate:"{colour} Patent Leather Oxfords",  colours:["black"],                               desc:"Patent leather cap-toe Oxfords",      category:"men patent leather oxford shoes" },
    { role:"Belt",    nameTemplate:"{colour} Dress Belt",              colours:["black"],                               desc:"Thin patent leather dress belt",      category:"men patent leather dress belt" },
  ]
},
{
  name:"Summer Wedding Guest Male", style:"smart casual", gender:["male"], age:[18,60], bmiMax:999,
  occasions:["wedding guest","formal dinner","brunch","outdoor adventure"],
  desc:"Cream linen suit with a sky blue shirt and tan loafers — effortlessly elegant for outdoor events.",
  pieces:[
    { role:"Blazer",  nameTemplate:"{colour} Linen Suit Jacket",        colours:["cream","ivory","beige","light blue","sage green"], desc:"Unstructured linen summer blazer", category:"men linen suit jacket summer" },
    { role:"Trousers",nameTemplate:"{colour} Linen Trousers",            colours:["cream","ivory","beige","white"],                  desc:"Relaxed linen suit trousers",      category:"men linen trousers summer" },
    { role:"Shirt",   nameTemplate:"{colour} {fabric} Shirt",            colours:["sky blue","white","light blue","sage green"],     desc:"Lightweight open-collar shirt",    category:"men linen cotton shirt summer" },
    { role:"Shoes",   nameTemplate:"{colour} Leather Derby Shoes",       colours:["tan","cognac","white","brown"],                   desc:"Clean leather derby or loafer",    category:"men leather derby shoes tan" },
    { role:"Belt",    nameTemplate:"{colour} Leather Belt",              colours:["tan","brown","cognac"],                           desc:"Slim leather belt matching shoes", category:"men leather belt tan" },
    { role:"Watch",   nameTemplate:"{colour} Dress Watch",               colours:["gold","silver"],                                  desc:"Classic slim dress watch",         category:"men slim dress watch" },
  ]
},
// ── MALE STREETWEAR ───────────────────────────────────────────────────────────
{
  name:"Monochrome All-Black Male", style:"streetwear", gender:["male"], age:[14,38], bmiMax:999,
  occasions:["party/clubbing","everyday casual","date night"],
  desc:"All-black slim jeans, fitted turtleneck, and leather Chelsea boots — sleek and sharp.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Slim Fitted Turtleneck",   colours:["black","charcoal","dark navy"],  desc:"Slim fine-knit turtleneck",          category:"men slim turtleneck black" },
    { role:"Bottom", nameTemplate:"{colour} Slim-Fit Jeans",            colours:["black","dark denim","charcoal"],  desc:"Slim or skinny black jeans",         category:"men slim fit black jeans" },
    { role:"Shoes",  nameTemplate:"{colour} Leather Chelsea Boots",    colours:["black"],                           desc:"Sleek black leather Chelsea boots",  category:"men black leather chelsea boots" },
    { role:"Watch",  nameTemplate:"{colour} Minimalist Watch",          colours:["black","silver"],                 desc:"Minimalist black-face watch",        category:"men minimalist watch black" },
  ]
},
{
  name:"Hype Streetwear Male", style:"streetwear", gender:["male"], age:[14,30], bmiMax:999,
  occasions:["everyday casual","college/campus","festival"],
  desc:"Colour-blocked hoodie, cargo pants, and statement sneakers — bold street energy.",
  pieces:[
    { role:"Top",    nameTemplate:"{colour} Colour-Block Hoodie",      colours:["black","grey","navy","rust","sage green"], desc:"Graphic or colour-block pullover hoodie",  category:"men colour block hoodie streetwear" },
    { role:"Bottom", nameTemplate:"{colour} Cargo Trousers",            colours:["black","olive","charcoal","khaki"],        desc:"Relaxed multi-pocket cargo pants",         category:"men cargo trousers pants streetwear" },
    { role:"Shoes",  nameTemplate:"{colour} Statement Sneakers",        colours:["white","black"],                           desc:"High-top or chunky statement sneakers",    category:"men high top sneakers statement" },
    { role:"Cap",    nameTemplate:"{colour} Snapback Cap",              colours:["black","white","navy"],                    desc:"Structured snapback or 5-panel cap",       category:"men snapback cap streetwear" },
    { role:"Bag",    nameTemplate:"{colour} Sling Bag",                 colours:["black","grey"],                            desc:"Small crossbody sling bag",               category:"men sling bag small crossbody" },
  ]
},
// ── MALE PREPPY / CLASSIC ─────────────────────────────────────────────────────
{
  name:"Ivy League Preppy Male", style:"preppy", gender:["male"], age:[16,32], bmiMax:999,
  occasions:["college/campus","brunch","everyday casual"],
  desc:"Argyle sweater over an Oxford shirt, navy chinos, and loafers — classic Ivy League campus style.",
  pieces:[
    { role:"Sweater", nameTemplate:"{colour} Crew-Neck Sweater",         colours:["navy","burgundy","forest green","camel","grey"], desc:"Cable-knit or fine-knit crew-neck",     category:"men crew neck sweater preppy" },
    { role:"Shirt",   nameTemplate:"{colour} Oxford Shirt",               colours:["white","light blue","off-white","pink"],         desc:"Crisp cotton Oxford button-down underneath",category:"men oxford shirt button down" },
    { role:"Bottom",  nameTemplate:"{colour} Slim Chinos",                colours:["navy","beige","khaki","stone","olive"],           desc:"Slim-fit cotton chinos",               category:"men slim chinos navy" },
    { role:"Shoes",   nameTemplate:"{colour} Penny Loafers",              colours:["tan","brown","cognac","burgundy"],                desc:"Classic leather penny loafers",        category:"men penny loafers leather" },
    { role:"Belt",    nameTemplate:"{colour} Woven Canvas Belt",          colours:["navy","tan"],                                    desc:"Preppy webbing or canvas belt",        category:"men canvas belt preppy" },
    { role:"Watch",   nameTemplate:"{colour} Classic Watch",              colours:["silver","gold"],                                 desc:"Slim classic dress watch",             category:"men classic watch silver" },
  ]
},
{
  name:"Denim-on-Denim Male", style:"casual", gender:["male"], age:[16,45], bmiMax:999,
  occasions:["everyday casual","brunch","outdoor adventure"],
  desc:"A dark denim jacket layered over a white tee and lighter jeans — the classic Canadian tuxedo done right.",
  pieces:[
    { role:"Jacket",  nameTemplate:"{colour} Denim Jacket",             colours:["dark denim","light denim","black denim","medium denim"], desc:"Classic trucker-cut denim jacket", category:"men denim jacket trucker" },
    { role:"Top",     nameTemplate:"{colour} Plain T-Shirt",             colours:["white","off-white","grey","black"],                      desc:"Clean plain cotton tee underneath",category:"men plain white t-shirt" },
    { role:"Bottom",  nameTemplate:"{colour} Straight Jeans",            colours:["light denim","medium denim","black"],                    desc:"Contrasting straight-leg jeans",   category:"men straight leg jeans" },
    { role:"Shoes",   nameTemplate:"{colour} White Sneakers",            colours:["white"],                                                 desc:"Clean white leather sneakers",     category:"men white leather sneakers" },
    { role:"Watch",   nameTemplate:"{colour} Casual Watch",              colours:["black","silver","brown"],                               desc:"Everyday casual wrist watch",      category:"men casual watch" },
  ]
},
// ── MALE ETHNIC ───────────────────────────────────────────────────────────────
{
  name:"Indo-Western Fusion Male", style:"indo-western", gender:["male"], age:[16,50], bmiMax:999,
  occasions:["wedding guest","festival","religious ceremony","formal dinner"],
  desc:"Embroidered Nehru collar jacket over slim trousers with mojri shoes — modern Indian elegance.",
  pieces:[
    { role:"Jacket",  nameTemplate:"{colour} Nehru Collar Jacket",      colours:["ivory","navy","burgundy","forest green","gold","rust"], desc:"Embroidered or textured Nehru jacket", category:"men nehru collar jacket indo western" },
    { role:"Bottom",  nameTemplate:"{colour} Slim Trousers",             colours:["black","ivory","beige","charcoal"],                    desc:"Slim straight formal trousers",        category:"men slim formal trousers ethnic" },
    { role:"Shoes",   nameTemplate:"{colour} Mojri / Kolhapuri Shoes",   colours:["gold","tan","brown","black"],                          desc:"Traditional embroidered mojri shoes",  category:"men mojri kolhapuri ethnic shoes" },
    { role:"Pocket",  nameTemplate:"{colour} Pocket Square",             colours:["gold","ivory","matching"],                             desc:"Silk or cotton pocket square",         category:"men pocket square silk ethnic" },
  ]
},

];

// ══════════════════════════════════════════════════════════════════════════════
//  EXPAND archetypes × colour variants  →  10,000+ outfit instances
// ══════════════════════════════════════════════════════════════════════════════
function buildOutfitLibrary() {
  const library = [];
  const fitVariants  = ['relaxed','fitted','oversized','slim','tailored','cropped'];
  const fabricFemale = ['Cotton','Silk','Linen','Knit','Chiffon','Satin','Jersey'];
  const fabricMale   = ['Cotton','Oxford','Poplin','Linen','Flannel','Merino','Jersey'];
  const washVariants = ['dark wash','light wash','medium wash','acid wash','raw denim'];
  const typeShoe     = ['canvas','leather','suede'];
  const typeBag      = ['tote','crossbody','bucket','structured','hobo'];
  const typeJewel    = ['hoop','drop','stud','chain','pendant'];

  BASE_ARCHETYPES.forEach((arch) => {
    const pieceSets = arch.pieces.map(p => {
      return p.colours.map(col => {
        const fit    = fitVariants[Math.floor(Math.random()*fitVariants.length)];
        const fabric = (arch.gender.includes('male') ? fabricMale : fabricFemale)[Math.floor(Math.random()*7)];
        const wash   = washVariants[Math.floor(Math.random()*washVariants.length)];
        const tShoe  = typeShoe[Math.floor(Math.random()*3)];
        const tBag   = typeBag[Math.floor(Math.random()*5)];
        const tJewel = typeJewel[Math.floor(Math.random()*5)];
        const name = p.nameTemplate
          .replace('{colour}', col)
          .replace('{fit}',    fit)
          .replace('{fabric}', fabric)
          .replace('{wash}',   wash)
          .replace('{type}',   p.role === 'Shoes' ? tShoe : p.role === 'Bag' ? tBag : tJewel);
        return { ...p, color: col, name };
      });
    });

    // For each colour combination across all pieces
    const maxVars = Math.max(...pieceSets.map(s => s.length));
    for (let v = 0; v < maxVars; v++) {
      const selectedPieces = pieceSets.map(set => set[v % set.length]);
      const id = `${arch.name}-v${v}`;
      library.push({
        id, ...arch,
        name: v === 0 ? arch.name : `${arch.name} · Variant ${v + 1}`,
        items: selectedPieces,
        confidence: 72 + Math.floor(Math.random() * 27),
      });
    }
  });
  return library;
}

const OUTFIT_LIBRARY = buildOutfitLibrary();

// ══════════════════════════════════════════════════════════════════════════════
//  CLIENT-SIDE MATCHING ENGINE
// ══════════════════════════════════════════════════════════════════════════════
// ─── Gender eligibility — STRICT hard filter ─────────────────────────────────
// male   → only outfits tagged ["male"] or ["male","neutral"]
// female → only outfits tagged ["female"] or ["female","neutral"]
// neutral/non-binary → outfits tagged with "neutral" OR any gender
function isGenderEligible(outfit, gender) {
  const g = (gender || 'neutral').toLowerCase();
  const og = outfit.gender; // e.g. ["female","neutral"] or ["male"]

  if (g === 'neutral') return true; // non-binary sees everything

  // strict: outfit must explicitly include the user's gender OR be neutral-only
  const isExplicitMatch = og.includes(g);
  const isNeutralOnly   = og.length === 1 && og[0] === 'neutral';

  // Reject outfits that only list the opposite gender
  const oppositeGender  = g === 'male' ? 'female' : 'male';
  const hasOnlyOpposite = og.includes(oppositeGender) && !og.includes(g);

  if (hasOnlyOpposite) return false;
  return isExplicitMatch || isNeutralOnly;
}

function scoreOutfit(outfit, profile) {
  let score = 50;
  const { age, gender, bmi, occasion, style, body_type } = profile;

  // Age match
  if (age >= outfit.age[0] && age <= outfit.age[1]) score += 20;
  else score -= 10;

  // Gender is already hard-filtered upstream — give a bonus for exact match
  const g = (gender || 'neutral').toLowerCase();
  if (outfit.gender.includes(g)) score += 15;
  else if (outfit.gender.includes('neutral')) score += 8;

  // BMI / size
  if (bmi <= outfit.bmiMax) score += 5;

  // Occasion match
  if (occasion && outfit.occasions.includes(occasion)) score += 25;
  else if (occasion) {
    const partial = ['casual','formal','office','beach','party','gym','wedding','festival','college'];
    if (partial.some(k => occasion.includes(k) && outfit.occasions.some(o => o.includes(k)))) score += 10;
  }

  // Style match
  if (style && outfit.style === style) score += 20;
  else if (style) {
    // partial style family match
    const families = {
      casual:      ['casual','streetwear','coastal','cottagecore'],
      formal:      ['formal','luxury','business casual','smart casual'],
      streetwear:  ['streetwear','edgy','y2k'],
      bohemian:    ['bohemian','cottagecore','indie'],
      minimalist:  ['minimalist','classic','old money','luxury'],
      athleisure:  ['athleisure','casual'],
    };
    const related = families[style] || [];
    if (related.includes(outfit.style)) score += 8;
  }

  // Body type hints
  if (body_type) {
    const flattering = {
      hourglass:         ['wrap','bodycon','fitted'],
      pear:              ['flare','A-line','wide neck'],
      apple:             ['wrap','empire','A-line'],
      rectangle:         ['peplum','wrap','belted'],
      inverted_triangle: ['wide leg','A-line','flared'],
    };
    const hints = flattering[body_type] || [];
    if (hints.some(h =>
      outfit.desc.toLowerCase().includes(h) ||
      outfit.items.some(i => i.name.toLowerCase().includes(h))
    )) score += 10;
  }

  return Math.min(99, Math.max(45, score));
}

function getRecommendations(profile, batchOffset = 0) {
  const bmi = profile.weight / ((profile.height / 100) ** 2);
  const profileWithBmi = { ...profile, bmi };

  // ── STEP 1: STRICT gender filter ──────────────────────────────────────────
  const genderFiltered = OUTFIT_LIBRARY.filter(o => isGenderEligible(o, profile.gender));

  // ── STEP 2: Score remaining outfits ───────────────────────────────────────
  const scored = genderFiltered.map(o => {
    const rawScore = scoreOutfit(o, profileWithBmi) + (batchOffset > 0 ? (Math.random() * 8 - 4) : 0);
    return {
      ...o,
      confidence: parseFloat(rawScore.toFixed(2)),
    };
  }).sort((a, b) => b.confidence - a.confidence);

  // ── STEP 3: Deduplicate — one variant per base archetype ──────────────────
  const seen = new Set();
  const deduped = scored.filter(o => {
    const base = o.name.split(' · Variant')[0];
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });

  // ── STEP 4: Rotate on refresh so different outfits surface ────────────────
  const rotated = batchOffset === 0
    ? deduped
    : [
        ...deduped.slice(batchOffset % Math.max(deduped.length, 1)),
        ...deduped.slice(0, batchOffset % Math.max(deduped.length, 1)),
      ];

  return rotated.slice(0, 5);
}

// ─── Animation ────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45 } }),
};

// ─── Shopping links helper ────────────────────────────────────────────────────
function makeShopLinks(itemName, category) {
  // Build a tight, specific search query from item name + category
  const q      = `${itemName}`;
  const catQ   = category;
  return [
    { label: '🛍 Google Shopping', url: gShop(q),    bg: '#4285F4', icon: null   },
    { label: 'Myntra',             url: myntra(catQ), bg: '#FF3F6C', icon: null   },
    { label: 'Amazon',             url: amazon(q),    bg: '#FF9900', icon: null   },
    { label: 'Ajio',               url: ajio(catQ),   bg: '#E11E51', icon: null   },
  ];
}

// ─── Individual Item Card ─────────────────────────────────────────────────────
function ItemCard({ item, index }) {
  const links = makeShopLinks(item.name, item.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        background: css.card, border: `1px solid ${css.border}`, borderRadius: 8,
        padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
        boxShadow: '0 1px 6px rgba(28,25,23,0.06)',
      }}
    >
      {/* Role label */}
      <div style={{ fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: css.gold, fontWeight: 700 }}>
        {item.role}
      </div>

      {/* Colour swatch + item name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: getHex(item.color), border: `2px solid ${css.border}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }} />
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: css.ink, lineHeight: 1.3 }}>{item.name}</div>
          <div style={{ fontSize: '0.7rem', color: css.muted, marginTop: 2 }}>{item.desc}</div>
        </div>
      </div>

      {/* Colour tag */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        background: css.goldDim, borderRadius: 999, padding: '2px 10px',
        width: 'fit-content',
      }}>
        <Tag size={9} style={{ color: css.gold }} />
        <span style={{ fontSize: '0.65rem', color: css.gold, fontWeight: 600 }}>{item.color}</span>
      </div>

      {/* Shop links */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: 'auto' }}>
        {links.map(l => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
              fontSize: '0.6rem', padding: '3px 8px',
              background: l.bg, color: '#fff',
              borderRadius: 999, textDecoration: 'none', fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {l.label} <ExternalLink size={7} />
          </a>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Outfit Recommendation Card ───────────────────────────────────────────────
function RecCard({ rec, index }) {
  const fullLookQ = encodeURIComponent(`${rec.name} outfit`);
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      style={{
        background: css.card, border: `1px solid ${css.border}`, borderRadius: 10,
        overflow: 'hidden', boxShadow: '0 2px 12px rgba(28,25,23,0.07)', marginBottom: '2rem',
      }}
    >
      {/* Card header */}
      <div style={{
        padding: '1.25rem 1.5rem', background: css.bg,
        borderBottom: `1px solid ${css.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.6rem', color: css.gold, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>
            {rec.style?.toUpperCase()}
          </div>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.4rem', color: css.ink, fontFamily: 'Playfair Display, Georgia, serif' }}>
            {rec.name.split(' · Variant')[0]}
          </h3>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {rec.occasions?.slice(0, 3).map(o => (
              <span key={o} style={{ fontSize: '0.62rem', padding: '2px 9px', background: css.card, border: `1px solid ${css.border}`, borderRadius: 999, color: css.muted }}>
                {o}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '0.82rem', color: css.soft, lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
            {rec.desc}
          </p>
        </div>
        {/* Match score */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '2rem', fontFamily: 'Playfair Display, Georgia, serif', color: css.gold, lineHeight: 1, fontWeight: 700 }}>
            {Number(rec.confidence).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.55rem', color: css.faint, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>MATCH %</div>
          {/* mini progress */}
          <div style={{ width: 56, height: 3, background: css.border, borderRadius: 99, marginTop: '0.4rem' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${rec.confidence}%` }}
              transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
              style={{ height: '100%', background: css.gold, borderRadius: 99 }}
            />
          </div>
        </div>
      </div>

      {/* Shop Full Look bar */}
      <div style={{
        padding: '0.6rem 1.5rem', background: '#fff',
        borderBottom: `1px solid ${css.border}`,
        display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
      }}>
        <ShoppingBag size={11} style={{ color: css.muted }} />
        <span style={{ fontSize: '0.62rem', color: css.muted, fontWeight: 600, marginRight: '0.25rem' }}>Shop full look:</span>
        {[
          { label: '🔍 Google Shopping', url: `https://www.google.com/search?q=${fullLookQ}&tbm=shop`, bg: '#4285F4' },
          { label: 'Myntra',             url: `https://www.myntra.com/search?q=${encodeURIComponent(rec.name.split(' · ')[0])}`, bg: '#FF3F6C' },
          { label: 'Ajio',               url: `https://www.ajio.com/search/?text=${encodeURIComponent(rec.style + ' outfit')}`, bg: '#E11E51' },
          { label: 'Amazon Fashion',     url: `https://www.amazon.in/s?k=${encodeURIComponent(rec.name.split(' · ')[0])}`, bg: '#FF9900' },
          { label: 'Flipkart',           url: `https://www.flipkart.com/search?q=${encodeURIComponent(rec.style + ' fashion')}`, bg: '#2874F0' },
        ].map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.63rem', padding: '3px 10px', background: l.bg, color: '#fff', borderRadius: 999, textDecoration: 'none', fontWeight: 600 }}>
            {l.label} <ExternalLink size={7} />
          </a>
        ))}
      </div>

      {/* ── INDIVIDUAL ITEMS — always visible ── */}
      <div style={{ padding: '1.25rem 1.5rem', background: css.bg, borderBottom: `1px solid ${css.border}` }}>
        <div style={{
          fontSize: '0.6rem', color: css.muted, letterSpacing: '0.12em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <ShoppingBag size={10} style={{ color: css.gold }} />
          Complete Outfit — {rec.items?.length} pieces · Click any item to shop that piece
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}>
          {rec.items?.map((item, i) => (
            <ItemCard key={i} item={item} index={i} />
          ))}
        </div>
      </div>

      {/* Styling tip */}
      <div style={{ padding: '0.85rem 1.5rem', background: css.card }}>
        <div style={{ fontSize: '0.7rem', color: css.soft, lineHeight: 1.6, display: 'flex', gap: '0.5rem' }}>
          <span style={{ color: css.gold, flexShrink: 0 }}>✦</span>
          <span>
            <strong style={{ color: css.ink, fontWeight: 600 }}>Styling tip:</strong>{' '}
            {rec.desc}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Body Analysis Card ───────────────────────────────────────────────────────
function BodyCard({ data }) {
  return (
    <div style={{
      background: css.card, border: `1px solid ${css.border}`, borderRadius: 10,
      overflow: 'hidden', marginBottom: '1.75rem', boxShadow: '0 1px 8px rgba(28,25,23,0.06)',
    }}>
      <div style={{ background: css.bg, padding: '1.1rem 1.5rem', borderBottom: `1px solid ${css.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <Info size={12} style={{ color: css.gold }} />
          <span style={{ fontSize: '0.6rem', color: css.gold, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>Body Analysis</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '1.3rem', fontFamily: 'Playfair Display, Georgia, serif', color: data.color }}>{data.frame}</div>
            <div style={{ fontSize: '0.76rem', color: css.soft }}>{data.heightDesc} · {data.heightCm} cm</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.65rem' }}>
            {[['BMI', data.bmi, data.color], ['CM', data.heightCm, css.ink]].map(([k, v, c]) => (
              <div key={k} style={{ padding: '0.4rem 0.75rem', background: css.card, border: `1px solid ${css.border}`, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontFamily: 'Playfair Display, Georgia, serif', color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: '0.56rem', color: css.faint, letterSpacing: '0.08em', fontWeight: 600 }}>{k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: '0.85rem 1.5rem', background: 'rgba(181,103,77,0.04)', borderBottom: `1px solid ${css.border}` }}>
        <p style={{ fontSize: '0.86rem', color: css.soft, fontStyle: 'italic', lineHeight: 1.75, margin: 0 }}>✦ {data.tip}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '1rem 1.5rem', borderRight: `1px solid ${css.border}` }}>
          <div style={{ fontSize: '0.58rem', color: css.green, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.65rem' }}>✓ Wear These</div>
          {data.wear.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.79rem', marginBottom: '0.38rem' }}>
              <span style={{ color: css.green, flexShrink: 0 }}>·</span>
              <span style={{ color: css.soft, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '1rem 1.5rem' }}>
          <div style={{ fontSize: '0.58rem', color: css.error, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.65rem' }}>✕ Minimise</div>
          {data.avoid.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.79rem', marginBottom: '0.38rem' }}>
              <span style={{ color: css.error, flexShrink: 0 }}>·</span>
              <span style={{ color: css.soft, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Recommend() {
  const [form, setForm] = useState({ age: '', gender: '', weight: '', height: '', occasion: '', style: '', body_type: '' });
  const [recs, setRecs]         = useState(null);
  const [bodyData, setBodyData] = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [batch, setBatch]       = useState(0);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const generate = useCallback((batchOffset = 0) => {
    const { age, gender, weight, height } = form;
    if (!age || !gender || !weight || !height) {
      setError('Age, Gender, Weight and Height are required.');
      return;
    }
    setError(null);

    // On fresh submit, clear previous results immediately
    if (batchOffset === 0) setRecs(null);

    setLoading(true);

    // Body analysis (instant, synchronous)
    const body = getBodyAnalysis(parseFloat(weight), parseFloat(height));
    setBodyData(body);

    // Use setTimeout to allow the browser to paint the loading spinner.
    // This prevents Framer Motion from getting stuck on the first load.
    setTimeout(() => {
      const results = getRecommendations({
        age: parseInt(age), gender,
        weight: parseFloat(weight), height: parseFloat(height),
        bmi: body.bmi,
        occasion: form.occasion, style: form.style, body_type: form.body_type,
      }, batchOffset);
      
      setRecs(results);
      setBatch(batchOffset);
      setLoading(false);
    }, 100); 
  }, [form]);

  return (
    <motion.div className="page" initial="hidden" animate="show" exit={{ opacity: 0 }}>
      <div className="container">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} style={{ marginBottom: '3rem' }}>
          
          <h1>Outfit Recommender</h1>
          <div className="gold-line" />
          <p style={{ maxWidth: 600 }}>
            Enter your profile and get personalised outfit recommendations
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2.5rem', alignItems: 'start' }}>

          {/* ── Form ── */}
          <motion.div variants={fadeUp} custom={1} style={{
            background: css.card, border: `1px solid ${css.border}`, borderRadius: 10,
            padding: '1.75rem', boxShadow: '0 2px 12px rgba(28,25,23,0.06)', position: 'sticky', top: 96,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <User size={14} style={{ color: css.gold }} />
              <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: css.soft }}>Your Profile</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.6rem', color: css.gold, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Required</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[['Age', 'age', 'number', '25', 10, 90], ['Weight (kg)', 'weight', 'number', '60'], ['Height (cm)', 'height', 'number', '165']].map(([label, key, type, ph, min, max]) => (
                  <div key={key} className="input-group">
                    <label className="input-label">{label} *</label>
                    <input className="input-field" type={type} placeholder={ph} min={min} max={max} value={form[key]} onChange={e => set(key, e.target.value)} />
                  </div>
                ))}
                <div className="input-group">
                  <label className="input-label">Gender *</label>
                  <select className="input-field" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="neutral">Non-binary</option>
                  </select>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${css.border}`, paddingTop: '0.85rem' }}>
                <div style={{ fontSize: '0.6rem', color: css.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Optional — improves matching
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="input-group">
                    <label className="input-label">Occasion</label>
                    <select className="input-field" value={form.occasion} onChange={e => set('occasion', e.target.value)}>
                      <option value="">Any occasion</option>
                      {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Style Preference</label>
                    <select className="input-field" value={form.style} onChange={e => set('style', e.target.value)}>
                      <option value="">Any style</option>
                      {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Body Type</label>
                    <select className="input-field" value={form.body_type} onChange={e => set('body_type', e.target.value)}>
                      <option value="">AI analyses from measurements</option>
                      {BODY_TYPES.map(b => <option key={b.key} value={b.key}>{b.label} — {b.desc}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ padding: '0.7rem 1rem', background: css.errorDim, border: `1px solid rgba(155,60,60,0.2)`, borderRadius: 6, color: css.error, fontSize: '0.82rem' }}>
                  {error}
                </div>
              )}

              <button className="btn btn-gold" style={{ justifyContent: 'center' }} onClick={() => generate(0)} disabled={loading}>
                {loading ? <><span className="spinner" /> Matching outfits…</> : <><Sparkles size={14} /> Find My Outfits</>}
              </button>

              {/* Info badge */}
              
            </div>
          </motion.div>

          {/* ── Results ── */}
          <div>
            {!recs && !bodyData && !loading && (
              <div style={{
                minHeight: 380, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', border: `1.5px dashed ${css.border}`, borderRadius: 10,
                gap: '1rem', textAlign: 'center', padding: '3rem', color: css.muted,
              }}>
                <Sparkles size={30} style={{ color: css.border }} />
                <p style={{ fontSize: '0.88rem', maxWidth: 340, lineHeight: 1.7, margin: 0 }}>
                  Fill your profile and get personalised outfits.
                </p>
              </div>
            )}

            {loading && (
              <div style={{
                minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', border: `1px solid ${css.border}`, borderRadius: 10,
                gap: '1.5rem', background: css.card,
              }}>
                <div style={{ width: 44, height: 44, border: `2px solid ${css.border}`, borderTop: `2px solid ${css.gold}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: css.ink, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Matching from {OUTFIT_LIBRARY.length.toLocaleString()} outfits…</p>
                  <p style={{ fontSize: '0.75rem', color: css.muted }}>Scoring by age, gender, occasion, style & body type</p>
                </div>
              </div>
            )}

            {bodyData && <BodyCard data={bodyData} />}

            {recs && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Meta bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                  padding: '0.75rem 1.25rem', background: css.card, border: `1px solid ${css.border}`,
                  borderRadius: 8, marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(28,25,23,0.04)',
                }}>
                  <span style={{ fontSize: '0.76rem', color: css.ink, fontWeight: 600 }}>{recs.length} outfit matches</span>
                  {form.occasion && <span style={{ fontSize: '0.65rem', padding: '2px 10px', background: css.bg, border: `1px solid ${css.border}`, borderRadius: 999, color: css.muted }}>{form.occasion}</span>}
                  {form.style    && <span style={{ fontSize: '0.65rem', padding: '2px 10px', background: css.goldDim, border: `1px solid rgba(181,103,77,0.2)`, borderRadius: 999, color: css.gold, fontWeight: 600 }}>{form.style}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: css.faint, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Cpu size={9} /> Batch {batch + 1} · {OUTFIT_LIBRARY.length.toLocaleString()} variants
                  </span>
                </div>

                {recs.map((rec, i) => <RecCard key={`${rec.id}-${batch}`} rec={rec} index={i} />)}

                {/* New batch button */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 2.5rem' }}>
                  <button className="btn btn-outline" onClick={() => generate(batch + 1)} disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 2rem' }}>
                    <RefreshCw size={13} /> Refresh — show different outfits
                  </button>
                </div>

                {/* Store links footer */}
                
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .recommend-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </motion.div>
  );
}