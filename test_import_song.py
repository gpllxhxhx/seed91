import urllib.request
import urllib.error
import json

# Test 1: POST with clean URL (no uct2 param)
data = json.dumps({"url": "https://music.163.com/song?id=2692390754"}).encode()
req = urllib.request.Request(
    "http://localhost:8000/api/songs/import",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    r = urllib.request.urlopen(req, timeout=10)
    print(f"Test 1 Status: {r.status}")
    print(f"Test 1 Body: {r.read().decode()[:500]}")
except urllib.error.HTTPError as e:
    print(f"Test 1 HTTPError: {e.code}")
    print(f"Test 1 Body: {e.read().decode()[:500]}")


# Test 2: POST with full URL
data2 = json.dumps({"url": "https://music.163.com/song?id=2692390754&uct2=U2FsdGVkX18/OpxIjzZd4YXzP51YBDE7T5AYC1eiUk8="}).encode()
req2 = urllib.request.Request(
    "http://localhost:8000/api/songs/import",
    data=data2,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    r2 = urllib.request.urlopen(req2, timeout=10)
    print(f"Test 2 Status: {r2.status}")
    print(f"Test 2 Body: {r2.read().decode()[:500]}")
except urllib.error.HTTPError as e:
    print(f"Test 2 HTTPError: {e.code}")
    print(f"Test 2 Body: {e.read().decode()[:500]}")

# Test 3: Check OpenAPI docs for available routes
try:
    r3 = urllib.request.urlopen("http://localhost:8000/openapi.json", timeout=5)
    docs = json.loads(r3.read())
    for path, methods in docs.get("paths", {}).items():
        if "song" in path.lower():
            print(f"  {path}: {list(methods.keys())}")
except Exception as e:
    print(f"OpenAPI read error: {e}") D