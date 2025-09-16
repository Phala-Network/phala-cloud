#!/usr/bin/env python3
"""
Test just the redirects from docs.json against production
"""

import json
import requests
import time

def test_redirect(source_path, base_url="https://phalanetwork-1606097b.mintlify.app"):
    """Test if a redirect works properly."""
    url = f"{base_url}{source_path}"
    try:
        response = requests.get(url, timeout=5, allow_redirects=True)
        final_url = response.url

        if response.status_code == 200:
            return True, response.status_code, final_url, None
        else:
            return False, response.status_code, final_url, f"Status code: {response.status_code}"

    except requests.exceptions.RequestException as e:
        return False, None, None, str(e)

def main():
    print("🔗 Testing redirects from docs.json against production")
    print("=" * 60)
    print(f"🌐 Base URL: https://phalanetwork-1606097b.mintlify.app")
    print("-" * 60)

    # Load redirects from docs.json
    with open("docs.json", "r") as f:
        docs_config = json.load(f)

    redirects = docs_config.get("redirects", [])
    print(f"🔍 Found {len(redirects)} redirects to test")
    print("-" * 60)

    successful = []
    failed = []

    for i, redirect in enumerate(redirects, 1):
        source = redirect.get("source", "")
        expected_dest = redirect.get("destination", "")

        print(f"[{i:2d}/{len(redirects)}] Testing: {source}")

        success, status_code, final_url, error = test_redirect(source)

        if success:
            # Check if we ended up at the expected destination
            expected_full = f"https://phalanetwork-1606097b.mintlify.app{expected_dest}"
            if final_url == expected_full:
                print(f"  ✅ {source} → {expected_dest} ✓")
                successful.append({
                    'source': source,
                    'expected': expected_dest,
                    'actual': final_url,
                    'status': 'correct_redirect'
                })
            else:
                print(f"  ⚠️  {source} → {final_url} (expected {expected_dest})")
                successful.append({
                    'source': source,
                    'expected': expected_dest,
                    'actual': final_url,
                    'status': 'unexpected_destination'
                })
        else:
            print(f"  ❌ {source} - {error or 'Failed'}")
            failed.append({
                'source': source,
                'expected': expected_dest,
                'status_code': status_code,
                'error': error
            })

        # Small delay to be nice to the server
        time.sleep(0.1)

    print("\n" + "=" * 60)
    print("📊 REDIRECT TEST SUMMARY")
    print("=" * 60)

    total = len(redirects)
    success_count = len(successful)
    fail_count = len(failed)

    print(f"📋 Total redirects: {total}")
    print(f"✅ Working redirects: {success_count}/{total} ({success_count/total*100:.1f}%)")
    print(f"❌ Failed redirects: {fail_count}/{total} ({fail_count/total*100:.1f}%)")

    # Count correct vs unexpected destinations
    correct_redirects = len([s for s in successful if s['status'] == 'correct_redirect'])
    unexpected_redirects = len([s for s in successful if s['status'] == 'unexpected_destination'])

    if successful:
        print(f"🎯 Correct destinations: {correct_redirects}")
        if unexpected_redirects > 0:
            print(f"⚠️  Unexpected destinations: {unexpected_redirects}")

    if failed:
        print(f"\n❌ FAILED REDIRECTS:")
        for fail in failed:
            print(f"  {fail['source']} → {fail['expected']}")
            if fail['error']:
                print(f"    Error: {fail['error']}")

    if unexpected_redirects > 0:
        print(f"\n⚠️  UNEXPECTED DESTINATIONS:")
        for redirect in successful:
            if redirect['status'] == 'unexpected_destination':
                print(f"  {redirect['source']}")
                print(f"    Expected: {redirect['expected']}")
                print(f"    Actual: {redirect['actual']}")

    return 0 if fail_count == 0 else 1

if __name__ == "__main__":
    exit(main())
