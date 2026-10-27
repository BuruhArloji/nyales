"""Bounded acquisition from the selected national ArcGIS source; never imports or activates.

python scripts/acquire-boundaries.py --district-code 31.71.01 --output <new-folder>
District selection is an explicit technical extract, not a business territory assignment.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

SOURCE = 'https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0'
FIELDS = 'objectid,kdppum,kdpkab,kdcpum,kdepum,wadmpr,wadmkk,wadmkc,wadmkd,tipadm'


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def fetch(path, params):
    url = SOURCE + path + '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as response:
        raw = response.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024:
        raise ValueError('Response exceeds acquisition limit')
    result = json.loads(raw)
    if 'error' in result:
        raise ValueError('Source query failed: ' + canonical(result['error']))
    return result


def acquire(district, output, page_size=2):
    if not re.fullmatch(r'\d{2}\.\d{2}\.\d{2}', district):
        raise ValueError('Explicit PUM district code required')
    if output.exists() or not output.parent.exists():
        raise ValueError('Output must be a NEW folder under an existing parent')
    where = "kdcpum='" + district + "'"
    meta = fetch('', {'f': 'json'})
    if meta.get('name') != 'ADMINISTRASI_DESAKELURAHAN_AR' or meta.get('extent', {}).get('spatialReference', {}).get('wkid') != 4326:
        raise ValueError('Unexpected source layer or CRS')
    count = fetch('/query', {'where': where, 'returnCountOnly': 'true', 'f': 'json'})['count']
    ids = sorted(fetch('/query', {'where': where, 'returnIdsOnly': 'true', 'f': 'json'})['objectIds'])
    if not 0 < count <= 1000 or len(ids) != count or len(set(ids)) != count:
        raise ValueError('Incomplete ID enumeration or scope above 1000 features')
    features, pages = [], []
    for offset in range(0, count, page_size):
        selected = ids[offset:offset + page_size]
        page = fetch('/query', {'objectIds': ','.join(map(str, selected)), 'outFields': FIELDS, 'returnGeometry': 'true', 'outSR': '4326', 'f': 'geojson'})
        received = page.get('features', [])
        actual = [f.get('properties', {}).get('objectid') for f in received]
        if page.get('exceededTransferLimit') or sorted(actual) != selected or page.get('type') != 'FeatureCollection':
            raise ValueError('Partial/duplicate/unexpected page, acquisition aborted')
        pages.append({'requested_ids': selected, 'received_ids': sorted(actual)})
        features.extend(received)
    after = sorted(fetch('/query', {'where': where, 'returnIdsOnly': 'true', 'f': 'json'})['objectIds'])
    if after != ids or len(features) != count:
        raise ValueError('Source membership changed during acquisition')
    normalized, unresolved = [], []
    for f in sorted(features, key=lambda f: f['properties']['objectid']):
        p = f['properties']
        if any(not p.get(k) for k in ['kdppum', 'kdpkab', 'kdcpum', 'kdepum', 'wadmpr', 'wadmkk', 'wadmkc', 'wadmkd']) or p.get('tipadm') not in (1, 2) or not f.get('geometry'):
            unresolved.append({'source_id': p.get('objectid'), 'reason': 'Missing code/name/geometry or unknown tipadm; no invented code/type'})
            continue
        normalized.append({'type': 'Feature', 'properties': {
            'source_id': str(p['objectid']),
            'province': {'code': p['kdppum'], 'name': p['wadmpr']},
            'regency': {'code': p['kdpkab'], 'name': p['wadmkk']},
            'district': {'code': p['kdcpum'], 'name': p['wadmkc']},
            'village': {'code': p['kdepum'], 'name': p['wadmkd'], 'type': 'desa' if p['tipadm'] == 1 else 'kelurahan'}
        }, 'geometry': f['geometry']})
    # Do not declare a partially normalized district import-ready.
    chunks, current = [], []
    for f in normalized:
        proposed = {'type': 'FeatureCollection', 'features': current + [f]}
        positions = lambda x: sum(len(ring) for feature in x for polygon in ([feature['geometry']['coordinates']] if feature['geometry']['type'] == 'Polygon' else feature['geometry']['coordinates']) for ring in polygon)
        if current and (len(current) >= 32 or len(canonical(proposed).encode()) > 1400 * 1024 or positions(current + [f]) > 40000):
            chunks.append({'type': 'FeatureCollection', 'features': current})
            current = []
        current.append(f)
    if current:
        chunks.append({'type': 'FeatureCollection', 'features': current})
    raw_collection = {'type': 'FeatureCollection', 'features': features}
    source_bytes = canonical(raw_collection).encode()
    # Python/JS serialize floating-point numbers differently. The TS packer computes
    # canonical checksums for normalized API chunks with the same code as the server.
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    metadata = {
        'provider': 'Geoportal Kementerian Pertanian', 'code_namespace': 'kemendagri-pum',
        'release_version': 'BIG-2025-S1-' + district + '-' + now[:10], 'released_at': None,
        'acquired_at': now, 'source_reference': SOURCE, 'source_checksum': sha(source_bytes),
        'metadata': {'reference_release': 'Semester 1 Tahun 2025; exact publication day not provided', 'origin': 'BIG according to source layer description', 'code_mapping': 'PUM fields kdppum/kdpkab/kdcpum/kdepum; tipadm 1=desa, 2=kelurahan is a technical mapping requiring review', 'usage_terms_status': 'unverified', 'notes': 'Released_at is null because exact publication day was not provided. Source copyrightText is empty; usage rights and type mapping require review. Full geometry retained; no simplification.'},
        'coverage': {'label': 'Technical district extract ' + district + '; not the selected business pilot area', 'source_filter': where, 'national_complete': False}
    }
    output.mkdir()
    files = {'source.geojson': source_bytes, 'metadata.json': canonical(meta).encode(), 'input.json': canonical({'dataset': metadata, 'chunks': chunks}).encode(), 'ACQUISITION.json': canonical({'source': SOURCE, 'acquired_at': now, 'where': where, 'count_before': count, 'enumerated_ids': ids, 'pages': pages, 'ids_after_match': True, 'received_count': len(features), 'normalized_count': len(normalized), 'unresolved': unresolved, 'source_sha256': sha(source_bytes), 'national_complete': False, 'imported': False, 'usage_terms_status': 'unverified'}).encode()}
    for name, raw in files.items():
        (output / name).write_bytes(raw)
    print(json.dumps({'output': str(output), 'source_features': count, 'normalized': len(normalized), 'unresolved': len(unresolved), 'bytes': len(source_bytes), 'imported': False, 'activation': 'requires usage-rights and metadata review'}))
    if unresolved:
        raise ValueError('Acquisition retained for review; normalization incomplete, do not import')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--district-code', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    acquire(args.district_code, args.output)
