import sys, json, os, re
from PIL import Image

try:
    from pdf2image import convert_from_path
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

KNOWN_CURRENCIES = ['EUR', 'USD', 'GBP', 'TRY', 'CHF', 'AED', 'SAR', 'EGP', 'MAD', 'JPY', 'TL', 'YTL']

def ocr_image(image_path, lang='tur+eng'):
    if not OCR_AVAILABLE:
        return {'error': 'pytesseract not installed'}
    image = Image.open(image_path)
    # Preprocess: convert to grayscale, increase contrast
    image = image.convert('L')
    text = pytesseract.image_to_string(image, lang=lang)
    return {'text': text, 'success': True}

def ocr_pdf(pdf_path, lang='tur+eng', dpi=200):
    if not PDF_SUPPORT:
        return {'error': 'pdf2image not installed'}
    images = convert_from_path(pdf_path, dpi=dpi)
    full_text = []
    for i, img in enumerate(images):
        img = img.convert('L')
        text = pytesseract.image_to_string(img, lang=lang)
        full_text.append('--- Page %d ---\n%s' % (i + 1, text))
    return {'text': '\n'.join(full_text), 'pages': len(images), 'success': True}


def parse_pricing_table(text):
    lines = text.strip().split('\n')
    lines = [l.strip() for l in lines if l.strip() and not l.startswith('---') and len(l.strip()) > 3]

    rows = []
    seen_names = set()

    occupancy_map = {
        'single': 1, 'tek kişilik': 1, 'tek kisi': 1,
        'double': 2, 'çift kişilik': 2, 'cift kisi': 2, 'twin': 2,
        'triple': 3, 'üç kişilik': 3, 'uc kisi': 3,
        'quad': 4, 'family': 4, 'aile': 4,
    }
    season_map = {
        'winter': 'low_season', 'kış': 'low_season', 'kis': 'low_season',
        'summer': 'high_season', 'yaz': 'high_season',
        'spring': 'mid_season', 'ilkbahar': 'mid_season',
        'autumn': 'mid_season', 'fall': 'mid_season', 'sonbahar': 'mid_season',
        'peak': 'peak', 'high': 'high_season', 'low': 'low_season',
        'shoulder': 'mid_season',
    }

    for line in lines:
        # Try to extract currency-prefixed or suffixed prices like "100EUR" or "EUR 100" or "$100"
        # Pattern: optional currency prefix + number, or number + optional currency suffix
        price_pattern = re.findall(
            r'(?:(' + '|'.join(KNOWN_CURRENCIES) + r')\s*)?(\d[\d.,]*)\s*(?:(' + '|'.join(KNOWN_CURRENCIES) + r'))?',
            line, re.IGNORECASE
        )
        prices = []
        for match in price_pattern:
            currency = (match[0] or match[2] or '').upper()
            if not currency:
                # Try to detect from the text near the number
                surrounding = line[max(0, line.find(match[1])-10):line.find(match[1])+len(match[1])+10]
                for c in KNOWN_CURRENCIES:
                    if c in surrounding.upper():
                        currency = c
                        break
            try:
                val = float(match[1].replace(',', ''))
                if val > 0 and val < 100000:
                    prices.append({'price': val, 'currency': currency or 'EUR'})
            except:
                pass

        if not prices:
            continue

        # Remove price text from line to get the name
        name_line = line
        for match in price_pattern:
            for g in match:
                if g:
                    name_line = name_line.replace(g, '')
        name = re.sub(r'[^\w\s/&-]', '', name_line).strip()
        name = re.sub(r'\s+', ' ', name).strip()

        if not name or len(name) < 2:
            continue
        if name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        # Detect occupancy from name
        occ = 1
        name_lower = name.lower()
        for key, val in occupancy_map.items():
            if key in name_lower:
                occ = val
                break

        # Detect season from names or column context
        for p in prices:
            for season_key, season_val in season_map.items():
                if season_key in line.lower():
                    p['season'] = season_val
                    break

        # Assign unique name if duplicate
        row = {'name': name, 'prices': prices, 'occupancy': occ}
        rows.append(row)

    # Try to group prices by room type if values look like columns
    if len(rows) > 1 and all(len(r['prices']) == 1 for r in rows):
        grouped = {}
        for r in rows:
            name = r['name']
            price = r['prices'][0]
            # Use simple word grouping
            words = name.lower().split()
            base_key = None
            for key in ['standard', 'deluxe', 'suite', 'superior', 'economy',
                        'single', 'double', 'triple', 'twin', 'family', 'king', 'queen']:
                for w in words:
                    if w == key or w.startswith(key) or key.startswith(w):
                        if base_key is None:
                            base_key = key
                        break
            if base_key:
                if base_key not in grouped:
                    grouped[base_key] = {'name': base_key.capitalize(), 'prices': [], 'occupancy': occ}
                grouped[base_key]['prices'].append(price)

        if grouped:
            rows = list(grouped.values())
            for r in rows:
                name_lower = r['name'].lower()
                for key, val in occupancy_map.items():
                    if key in name_lower:
                        r['occupancy'] = val
                        break

    return {'rows': rows, 'success': True}


if __name__ == '__main__':
    args = json.loads(sys.argv[1])
    file_path = args.get('path', '')
    lang = args.get('lang', 'tur+eng')
    parse = args.get('parse', True)
    supplier_category = args.get('supplier_category')

    if not os.path.exists(file_path):
        result = {'error': 'File not found: %s' % file_path}
    elif file_path.lower().endswith('.pdf'):
        result = ocr_pdf(file_path, lang=lang)
    else:
        result = ocr_image(file_path, lang=lang)

    if result.get('success') and parse and result.get('text'):
        parsed = parse_pricing_table(result['text'])
        result['parsed'] = parsed

    print(json.dumps(result, ensure_ascii=False, default=str))
