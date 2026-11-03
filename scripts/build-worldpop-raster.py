"""Prepare public WorldPop counts as density PNG PMTiles; never includes NYALES data.

Install rasterio pillow mercantile pmtiles in an isolated venv. Input must be the
official IDN 2026 R2025A v1 constrained 100m GeoTIFF. Output units are people/km2,
using WGS84 ellipsoid pixel areas (not a constant 100m x 100m assumption).
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path

import mercantile
import numpy as np
import rasterio
from PIL import Image
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.windows import from_bounds

SOURCE = 'https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2026/IDN/v1/100m/constrained/idn_pop_2026_CN_100m_R2025A_v1.tif'
COLORS = ['#edf5f1', '#c5e4d8', '#82bfa9', '#398b78', '#0b5f54']
BREAKS = [100, 1000, 5000, 10000]


def pixel_area_km2(transform, row_start, height):
    a, e2 = 6378137.0, 6.6943799901413165e-3
    e = math.sqrt(e2)
    rows = np.arange(row_start, row_start + height + 1)
    u = np.sin(np.radians(transform.f + rows * transform.e))
    primitive = (u / (1 - e2 * u * u) + np.arctanh(e * u) / e) / 2
    return np.abs(np.diff(primitive)) * a * a * (1 - e2) * math.radians(abs(transform.a)) / 1e6


def main():
    p = argparse.ArgumentParser()
    p.add_argument('input', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--maxzoom', type=int, default=11, choices=range(8, 12))
    args = p.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    density = args.output / 'density-native.tif'
    if not density.exists():
        temporary = density.with_suffix('.partial.tif')
        with rasterio.open(args.input) as src:
            if src.crs.to_epsg() != 4326 or src.count != 1 or abs(src.res[0] - 1 / 1200) > 1e-9:
                raise ValueError('Expected WorldPop WGS84 3-arc-second count raster')
            profile = {**src.profile, 'compress': 'deflate', 'predictor': 3, 'BIGTIFF': 'IF_SAFER'}
            total, occupied = 0.0, 0
            with rasterio.open(temporary, 'w', **profile) as dst:
                for _, window in src.block_windows(1):
                    values = src.read(1, window=window, masked=True)
                    valid = ~np.ma.getmaskarray(values) & (values.data >= 0) & np.isfinite(values.data)
                    areas = pixel_area_km2(src.transform, int(window.row_off), int(window.height))[:, None]
                    data = np.where(valid, values.data / areas, src.nodata).astype('float32')
                    dst.write(data, 1, window=window)
                    total += float(np.sum(values.data[valid], dtype='float64'))
                    occupied += int(np.sum(valid & (values.data > 0)))
                dst.build_overviews([2, 4, 8, 16, 32, 64, 128], Resampling.average)
                dst.update_tags(units='people/km2', source=SOURCE, year=2026, resampling='average')
        temporary.replace(density)
        (args.output / 'source-stats.json').write_text(json.dumps({'population_sum': total, 'positive_pixels': occupied}), encoding='utf-8')
        print('Native density and overviews ready', flush=True)

    output = args.output / 'worldpop-idn-2026-density.pmtiles'
    partial = output.with_suffix('.partial.pmtiles')
    bounds = (94.9899989, -11.008333, 141.021666, 6.076667)
    tiles = sorted((zxy_to_tileid(t.z, t.x, t.y), t) for z in range(args.maxzoom + 1) for t in mercantile.tiles(*bounds, [z]))
    palette = np.array([[int(c[n:n + 2], 16) for n in (1, 3, 5)] for c in COLORS], dtype='uint8')
    count = 0
    metadata = {'name': 'WorldPop Indonesia 2026 density', 'attribution': 'WorldPop (2026, R2025A v1) · CC BY 4.0', 'source': SOURCE, 'license': 'https://creativecommons.org/licenses/by/4.0/', 'units': 'people/km2', 'source_resolution': '3 arc-seconds (~100m)', 'method': 'Population count / WGS84 ellipsoid source pixel area; average resampling; zero and NoData transparent', 'breaks': BREAKS, 'colors': COLORS, 'year': 2026, 'modeled_estimate': True}
    with rasterio.open(density) as src, partial.open('wb') as out:
        writer = Writer(out)
        with WarpedVRT(src, crs='EPSG:3857', resampling=Resampling.average) as vrt:
            for index, (tileid, tile) in enumerate(tiles):
                b = mercantile.xy_bounds(tile)
                window = from_bounds(b.left, b.bottom, b.right, b.top, vrt.transform)
                # The VRT covers only Indonesia; pad the tile intersection rather
                # than using boundless VRT reads (unsupported by GDAL).
                left, top = max(0, window.col_off), max(0, window.row_off)
                right, bottom = min(vrt.width, window.col_off + window.width), min(vrt.height, window.row_off + window.height)
                x0 = max(0, round((left - window.col_off) / window.width * 256))
                y0 = max(0, round((top - window.row_off) / window.height * 256))
                x1 = min(256, round((right - window.col_off) / window.width * 256))
                y1 = min(256, round((bottom - window.row_off) / window.height * 256))
                if x1 <= x0 or y1 <= y0:
                    continue
                w = rasterio.windows.Window(left, top, right - left, bottom - top)
                data = vrt.read(1, window=w, out_shape=(y1 - y0, x1 - x0), masked=True, resampling=Resampling.average)
                visible = ~np.ma.getmaskarray(data) & np.isfinite(data.data) & (data.data > 0)
                if np.any(visible):
                    rgba = np.zeros((256, 256, 4), dtype='uint8')
                    rgba[y0:y1, x0:x1, :3] = palette[np.digitize(data.data, BREAKS)]
                    rgba[y0:y1, x0:x1, 3] = visible.astype('uint8') * 255
                    png = io.BytesIO()
                    Image.fromarray(rgba).save(png, format='PNG', optimize=False)
                    writer.write_tile(tileid, png.getvalue())
                    count += 1
                if index % 1000 == 0:
                    print(f'Tiles {index}/{len(tiles)}; nonempty {count}', flush=True)
        writer.finalize({'tile_type': TileType.PNG, 'tile_compression': Compression.NONE, 'min_lon_e7': round(bounds[0] * 1e7), 'min_lat_e7': round(bounds[1] * 1e7), 'max_lon_e7': round(bounds[2] * 1e7), 'max_lat_e7': round(bounds[3] * 1e7), 'center_zoom': 7, 'center_lon_e7': 1070000000, 'center_lat_e7': -62000000}, metadata)
    partial.replace(output)
    manifest = {**metadata, 'tile_count': count, 'maxzoom': args.maxzoom, 'byte_count': output.stat().st_size, 'sha256': hashlib.file_digest(output.open('rb'), 'sha256').hexdigest(), 'source_sha256': hashlib.file_digest(args.input.open('rb'), 'sha256').hexdigest()}
    (args.output / 'worldpop-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'tiles': count, 'bytes': output.stat().st_size, 'complete': True}), flush=True)


if __name__ == '__main__':
    main()
