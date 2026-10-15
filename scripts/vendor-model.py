#!/usr/bin/env python3
"""Reproduce pinned runtime and WASM vendoring; never downloads model weights."""
import base64, hashlib, io, json, pathlib, tarfile, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = '0.2.86'
INTEGRITY = 'plciXBCYtY7iTKHzEcsqOfSO+s5u8NqMYFPnHmRbsN8CEdKcolgXIoGLPbzO6FtJHV43m7YP00x6qQ6Kb8CJJw=='
BLOB = '2074819d0f0d77654d4fe9b3ce7f2aa29212c04b'
def fetch(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=180) as response:
        return response.read()
def main():
    target = ROOT / 'web/vendor'
    target.mkdir(parents=True, exist_ok=True)
    archive = fetch(f'https://registry.npmjs.org/@mlc-ai/web-llm/-/web-llm-{VERSION}.tgz')
    assert base64.b64encode(hashlib.sha512(archive).digest()).decode() == INTEGRITY, 'Runtime integrity mismatch'
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as bundle:
        for src, dest in [('package/lib/index.js', 'webllm.js'), ('package/LICENSE', 'LICENSE-webllm')]:
            (target / dest).write_bytes(bundle.extractfile(src).read())
    try:
        wasm = fetch(f'https://api.github.com/repos/mlc-ai/binary-mlc-llm-libs/git/blobs/{BLOB}', {'Accept':'application/vnd.github.raw+json'})
    except Exception:
        wasm = fetch('https://cdn.jsdelivr.net/gh/mlc-ai/binary-mlc-llm-libs@main/web-llm-models/v0_2_86/base/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm')
    if wasm[:4] != b'\0asm':
        wasm = base64.b64decode(json.loads(wasm)['content'])
    digest = hashlib.sha1(f'blob {len(wasm)}\0'.encode() + wasm).hexdigest()
    assert digest == BLOB, 'WASM Git blob mismatch'
    (target / 'qwen3-0.6b-webgpu.wasm').write_bytes(wasm)
    print('Verified and vendored WebLLM runtime and Qwen3 WASM. No weights downloaded.')
def weights():
    import concurrent.futures, subprocess
    revision = '8c14ce481d4c692769976ad52afea453a102df19'
    cache = ROOT / '.cache/model'
    cache.mkdir(parents=True, exist_ok=True)
    tree = [{'path': r['path'], 'size': r['bytes'], 'sha256': r.get('sha256')} for r in json.loads((ROOT / 'web/model-manifest.json').read_text())['files']]
    def download(record):
        name, expected = record['path'], record.get('size', 0)
        path = cache / name
        if not path.exists() or path.stat().st_size != expected:
            for host, limit in [('huggingface.co', 12), ('hf-mirror.com', 600)]:
                result = subprocess.run(['curl', '--max-time', str(limit), '--retry', '1', '-C', '-', '-LfsS', f'https://{host}/mlc-ai/Qwen3-0.6B-q4f16_1-MLC/resolve/{revision}/{name}', '-o', str(path)])
                if result.returncode == 0 and path.stat().st_size == expected:
                    break
            else:
                raise RuntimeError(f'Cannot download {name}')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if record.get('sha256') and digest != record['sha256']:
            raise RuntimeError(f'Weight integrity mismatch: {name}')
        return {'path': name, 'bytes': path.stat().st_size, 'sha256': digest}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        records = list(executor.map(download, tree))
    manifest = {'upstream': 'https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC', 'revision': revision, 'status': 'verified', 'files': records}
    (ROOT / 'web/model-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('Verified weights saved under', cache, flush=True)
if __name__ == '__main__':
    import sys
    weights() if '--weights' in sys.argv else main()
