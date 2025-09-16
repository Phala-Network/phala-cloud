#!/usr/bin/env python3
"""
Script to validate redirects in Mintlify docs.json
Extracts all available page paths and checks that redirect targets are valid
"""

import json
import sys
import re
from typing import Set, List, Dict, Any


def normalize_url(url: str) -> str:
    """Normalize URL by removing leading/trailing slashes and ensuring consistency"""
    return url.strip().strip("/")


def generate_parent_paths(path: str) -> Set[str]:
    """Generate all parent paths for a given path"""
    parent_paths = set()

    # Normalize the path
    clean_path = normalize_url(path)
    if not clean_path:
        return parent_paths

    # Split into parts
    parts = clean_path.split("/")

    # Generate all parent paths
    for i in range(len(parts)):
        parent_path = "/".join(parts[:i+1])
        if parent_path:
            parent_paths.add("/" + parent_path)

    return parent_paths


def extract_pages_from_navigation(nav_item) -> Set[str]:
    """Recursively extract all page paths from navigation structure"""
    pages = set()

    if isinstance(nav_item, str):
        # Single page path - normalize and ensure leading slash
        normalized = normalize_url(nav_item)
        if normalized:
            pages.add("/" + normalized)
    elif isinstance(nav_item, dict):
        if "pages" in nav_item:
            # Group with pages
            for page in nav_item["pages"]:
                pages.update(extract_pages_from_navigation(page))
        elif "group" in nav_item and "pages" in nav_item:
            # Named group with pages
            for page in nav_item["pages"]:
                pages.update(extract_pages_from_navigation(page))
    elif isinstance(nav_item, list):
        # List of items
        for item in nav_item:
            pages.update(extract_pages_from_navigation(item))

    return pages


def get_all_available_paths(docs_config: Dict[str, Any]) -> Set[str]:
    """Extract all available page paths from docs.json including implied parent paths"""
    available_paths = set()

    # Extract from navigation
    if "navigation" in docs_config:
        nav = docs_config["navigation"]

        # Handle tabs structure (current format)
        if "tabs" in nav:
            for tab in nav["tabs"]:
                # Handle tabs with "groups" array (like Phala Cloud)
                if "groups" in tab:
                    for group in tab["groups"]:
                        available_paths.update(extract_pages_from_navigation(group))
                # Handle tabs with "pages" array directly (like Network, Dstack, Confidential AI)
                elif "pages" in tab:
                    for page in tab["pages"]:
                        available_paths.update(extract_pages_from_navigation(page))

        # Handle anchors structure (legacy format)
        if "anchors" in nav:
            for anchor in nav["anchors"]:
                if "groups" in anchor:
                    for group in anchor["groups"]:
                        available_paths.update(extract_pages_from_navigation(group))

        # Handle direct navigation items
        if "pages" in nav:
            available_paths.update(extract_pages_from_navigation(nav["pages"]))

    # Generate parent paths for all navigation paths
    all_paths_with_parents = set(available_paths)
    for path in available_paths:
        all_paths_with_parents.update(generate_parent_paths(path))

    # Add root path "/" if "/index" exists (common Mintlify convention)
    if "/index" in all_paths_with_parents:
        all_paths_with_parents.add("/")

    return all_paths_with_parents


def matches_mintlify_pattern(path: str, pattern: str) -> bool:
    """Check if a path matches a Mintlify wildcard pattern like /:slug*"""
    # Convert Mintlify pattern to regex step by step

    # First, replace :slug* with a placeholder to avoid conflicts
    regex_pattern = pattern.replace(':slug*', '__SLUG_WILDCARD__')

    # Escape all special regex characters
    regex_pattern = re.escape(regex_pattern)

    # Now replace our placeholder with the actual regex pattern
    # :slug* should match at least one path segment and optionally more
    regex_pattern = regex_pattern.replace('__SLUG_WILDCARD__', '[^/]+.*')

    # Ensure we match the full string
    regex_pattern = f'^{regex_pattern}$'

    try:
        return bool(re.match(regex_pattern, path))
    except re.error:
        # Fallback to exact match if regex fails
        return path == pattern

def path_matches_any_available(destination: str, available_paths: Set[str]) -> bool:
    """Check if destination matches any available path, including wildcard patterns"""
    # Normalize destination path for comparison
    normalized_destination = "/" + normalize_url(destination) if normalize_url(destination) else destination

    # First check exact match
    if normalized_destination in available_paths:
        return True

    # Then check if any available path matches as a wildcard pattern
    for available_path in available_paths:
        if matches_mintlify_pattern(normalized_destination, available_path):
            return True

    return False

def validate_redirects(docs_config: Dict[str, Any], available_paths: Set[str]) -> List[Dict[str, str]]:
    """Validate that all redirect destinations point to valid paths"""
    invalid_redirects = []

    if "redirects" not in docs_config:
        return invalid_redirects

    for redirect in docs_config["redirects"]:
        source = redirect.get("source", "")
        destination = redirect.get("destination", "")

        # Check if destination matches any available path (exact or pattern)
        if not path_matches_any_available(destination, available_paths):
            invalid_redirects.append({
                "source": source,
                "destination": destination,
                "reason": "Destination path not found in navigation or parent paths"
            })

    return invalid_redirects


def main():
    """Main function to run redirect validation"""
    try:
        # Load docs.json
        with open("docs.json", "r") as f:
            docs_config = json.load(f)

        print("🔍 Extracting available page paths from navigation...")
        available_paths = get_all_available_paths(docs_config)

        print(f"✅ Found {len(available_paths)} available page paths")

        print("\n📋 Available paths:")
        for path in sorted(available_paths):
            print(f"  - {path}")

        print(f"\n🔗 Validating {len(docs_config.get('redirects', []))} redirects...")
        invalid_redirects = validate_redirects(docs_config, available_paths)

        if not invalid_redirects:
            print("✅ All redirects are valid!")
            return 0
        else:
            print(f"❌ Found {len(invalid_redirects)} invalid redirects:")
            for redirect in invalid_redirects:
                print(f"  - {redirect['source']} → {redirect['destination']}")
                print(f"    Reason: {redirect['reason']}")
            return 1

    except FileNotFoundError:
        print("❌ Error: docs.json not found in current directory")
        return 1
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing docs.json: {e}")
        return 1
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
