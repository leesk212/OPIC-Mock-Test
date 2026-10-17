#!/usr/bin/env python3
"""Seal the current tunnel address so it can be published in go/tunnel.json.

    python3 scripts/seal_tunnel.py            # reads .access_token and tunnel.json, prints the sealed JSON
    python3 scripts/seal_tunnel.py --write    # also writes go/tunnel.json

Only someone holding the access key can open it: the address is XOR-ed with an
HMAC-SHA256 keystream derived from the key and a random nonce, and authenticated
with a separate HMAC tag. go/index.html reverses this with WebCrypto in the
browser, using the key from the part of the link after '#'.
Standard library only.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def keystream(key: bytes, nonce: bytes, n: int) -> bytes:
    out, i = b"", 0
    while len(out) < n:
        out += hmac.new(key, b"ks" + nonce + i.to_bytes(4, "big"), hashlib.sha256).digest()
        i += 1
    return out[:n]


def seal(token: str, url: str, started: str = "") -> dict:
    key = hashlib.sha256(("opic-go:" + token).encode()).digest()
    nonce = os.urandom(16)
    pt = url.encode()
    ct = bytes(a ^ b for a, b in zip(pt, keystream(key, nonce, len(pt))))
    tag = hmac.new(key, b"tag" + nonce + ct, hashlib.sha256).digest()
    b64 = lambda b: base64.b64encode(b).decode()
    return {"v": 1, "n": b64(nonce), "c": b64(ct), "t": b64(tag), "updated": started}


if __name__ == "__main__":
    token = (ROOT / ".access_token").read_text(encoding="utf-8").strip()
    t = json.loads((ROOT / "tunnel.json").read_text(encoding="utf-8"))
    sealed = seal(token, t["url"], t.get("started", ""))
    text = json.dumps(sealed)
    if "--write" in sys.argv:
        (ROOT / "go").mkdir(exist_ok=True)
        (ROOT / "go" / "tunnel.json").write_text(text + "\n", encoding="utf-8")
    print(text)
