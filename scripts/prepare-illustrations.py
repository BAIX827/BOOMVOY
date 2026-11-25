"""Copy generated masters and export bounded, alpha-preserving web assets."""
import json
import shutil
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
local_manifest = root / 'output/illustration-masters/generation.json'
manifest_path = local_manifest if local_manifest.exists() else root / 'docs/illustration-generation.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for asset in manifest['assets']:
    version = asset.get('version', 1)
    master = root / 'output/illustration-masters' / f"{asset['id']}-v{version}.png"
    if not master.exists():
        if not asset.get('source'):
            raise FileNotFoundError(f'Restore {master} from the PNG archive before exporting.')
        shutil.copy2(asset['source'], master)
    for width, height, suffix, quality in [(960, 640, '', 86), (480, 320, '-480', 84)]:
        output = root / 'src/assets/illustrations' / asset['kind'] / f"{asset['id']}-v{version}{suffix}.webp"
        if output.exists() and output.stat().st_size > 0 and output.stat().st_mtime >= master.stat().st_mtime:
            continue
        with Image.open(master) as original:
            image = original.convert('RGBA')
        assert image.getchannel('A').getextrema()[0] == 0, f"Missing alpha: {master}"
        image = image.crop(image.getchannel('A').getbbox())
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        if image.width < width:
            # Tall landmarks retain their shape; transparent padding keeps srcset widths truthful.
            canvas = Image.new('RGBA', (width, image.height), (0, 0, 0, 0))
            canvas.paste(image, ((width - image.width) // 2, 0))
            image = canvas
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, 'WEBP', quality=quality, method=6)
        print(f'{output.relative_to(root)}: {image.width}x{image.height}, {output.stat().st_size // 1024} KiB')
