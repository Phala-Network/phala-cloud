#!/usr/bin/env python3
"""
Check all extracted documentation links for coverage:
1. Navigation accessibility (reachable through docs.json navigation + parent paths)
2. Redirect coverage (covered by redirects in docs.json with wildcard support)

Note: File existence is handled by Mintlify build process, so we focus on link coverage.
"""
import json
import re
from pathlib import Path
from typing import Set, List, Dict, Any

def normalize_url(url: str) -> str:
    """Normalize URL by removing leading/trailing slashes and ensuring consistency"""
    return url.strip().strip("/")

def load_docs_config(docs_json_path: str) -> dict:
    """Load complete docs.json configuration"""
    with open(docs_json_path, 'r') as f:
        return json.load(f)

def load_redirects(docs_config: dict) -> List[Dict[str, str]]:
    """Load redirects list from docs.json with wildcard support"""
    redirects = []
    for redirect in docs_config.get("redirects", []):
        source = normalize_url(redirect["source"])
        destination = normalize_url(redirect["destination"])
        redirects.append({"source": source, "destination": destination})

    return redirects

def extract_navigation_links(nav_item: Any, links: Set[str]):
    """Recursively extract all page paths from navigation structure"""
    if isinstance(nav_item, str):
        # Normalize the link
        clean_link = normalize_url(nav_item)
        if clean_link:
            links.add(clean_link)
    elif isinstance(nav_item, dict):
        # Handle pages in groups
        if "pages" in nav_item:
            for page in nav_item["pages"]:
                extract_navigation_links(page, links)
        # Handle tab structures
        if "groups" in nav_item:
            for group in nav_item["groups"]:
                extract_navigation_links(group, links)
        # Handle other nested structures
        for key, value in nav_item.items():
            if key not in ["group", "tab", "icon", "pages", "groups"]:
                extract_navigation_links(value, links)
    elif isinstance(nav_item, list):
        for item in nav_item:
            extract_navigation_links(item, links)

def get_all_navigation_links(docs_config: dict) -> Set[str]:
    """Extract all links from docs.json navigation structure"""
    nav_links = set()

    navigation = docs_config.get("navigation", {})

    # Extract from tabs
    if "tabs" in navigation:
        for tab in navigation["tabs"]:
            extract_navigation_links(tab, nav_links)

    # Extract from anchors (legacy structure)
    if "anchors" in navigation:
        for anchor in navigation["anchors"]:
            extract_navigation_links(anchor, nav_links)

    return nav_links

def get_all_redirect_links(docs_config: dict) -> Set[str]:
    """Extract all source and destination paths from redirects"""
    redirect_links = set()

    for redirect in docs_config.get("redirects", []):
        source = normalize_url(redirect["source"])
        destination = normalize_url(redirect["destination"])

        if source:
            redirect_links.add(source)
        if destination:
            redirect_links.add(destination)

    return redirect_links


def find_matching_redirect(link: str, redirects: List[Dict[str, str]]) -> str:
    """Find a redirect destination for a link, supporting Mintlify wildcard patterns like /:slug*"""
    for redirect in redirects:
        source = redirect["source"]
        destination = redirect["destination"]

        # Check for exact match first
        if link == source:
            return destination

        # Check for Mintlify wildcard match (/:slug* pattern)
        if matches_mintlify_pattern(link, source):
            # For wildcard patterns, substitute the captured slug if needed
            return substitute_slug_in_destination(link, source, destination)

    return None

def matches_mintlify_pattern(link: str, pattern: str) -> bool:
    """Check if a link matches a Mintlify wildcard pattern like /:slug*"""
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
        return bool(re.match(regex_pattern, link))
    except re.error:
        # Fallback to exact match if regex fails
        return link == pattern

def substitute_slug_in_destination(link: str, source_pattern: str, destination: str) -> str:
    """Substitute captured slug from source pattern into destination if needed"""
    # For now, return destination as-is since most redirects don't need substitution
    # This could be enhanced later to support slug substitution in destinations
    return destination

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
            parent_paths.add(parent_path)

    return parent_paths

def main():
    # Load extracted links from all .txt files in .scripts/used_links
    links = []
    used_links_dir = Path('.scripts/used_links')
    for txt_file in used_links_dir.glob('*.txt'):
        with open(txt_file, 'r') as f:
            raw_links = [line.strip() for line in f.readlines() if line.strip()]
            # Normalize all links
            links.extend([normalize_url(link) for link in raw_links if normalize_url(link)])

    # Load docs.json configuration
    docs_config = load_docs_config('docs.json')
    redirects = load_redirects(docs_config)

    # Get navigation and redirect links for accessibility check
    nav_links = get_all_navigation_links(docs_config)
    redirect_links = get_all_redirect_links(docs_config)

    # Generate parent paths for all navigation links
    accessible_links = nav_links.union(redirect_links)
    parent_paths = set()
    for link in nav_links:
        parent_paths.update(generate_parent_paths(link))

    # Include parent paths as accessible
    accessible_links.update(parent_paths)

    # Check each link
    accessible_links_list = []
    redirected_links = []
    uncovered_links = []

    print(f"Checking {len(links)} documentation links...")
    print("=" * 60)

    for link in links:
        # Normalize the link before checking
        normalized_link = normalize_url(link)
        is_accessible = normalized_link in accessible_links

        if is_accessible:
            accessible_links_list.append(normalized_link)
        else:
            # Check for redirect match (exact or wildcard)
            destination = find_matching_redirect(normalized_link, redirects)
            if destination:
                redirected_links.append((normalized_link, destination))
            else:
                uncovered_links.append(normalized_link)

    # Report results
    print(f"\n🔗 ACCESSIBLE LINKS ({len(accessible_links_list)}):")
    print("-" * 40)
    for link in sorted(accessible_links_list):
        print(f"  {link}")

    print(f"\n🔄 REDIRECTED LINKS ({len(redirected_links)}):")
    print("-" * 40)
    for source, dest in sorted(redirected_links):
        print(f"  {source} -> {dest}")

    print(f"\n⚠️  UNCOVERED LINKS ({len(uncovered_links)}):")
    print("-" * 40)
    print("  Links that need either navigation coverage or redirects:")
    for link in sorted(uncovered_links):
        print(f"  {link}")

    # Save results to files
    with open('tmp/accessible_links.txt', 'w') as f:
        for link in sorted(accessible_links_list):
            f.write(f"{link}\n")

    with open('tmp/redirected_links.txt', 'w') as f:
        for source, dest in sorted(redirected_links):
            f.write(f"{source} -> {dest}\n")

    with open('tmp/uncovered_links.txt', 'w') as f:
        for link in sorted(uncovered_links):
            f.write(f"{link}\n")

    print(f"\n📊 SUMMARY:")
    print(f"  Total links checked: {len(links)}")
    print(f"  Accessible through navigation: {len(accessible_links_list)}")
    print(f"  Covered by redirects: {len(redirected_links)}")
    print(f"  Uncovered (need attention): {len(uncovered_links)}")
    print(f"  Coverage rate: {((len(accessible_links_list) + len(redirected_links)) / len(links) * 100):.1f}%")

    print(f"\n📁 Results saved to:")
    print(f"  - tmp/accessible_links.txt")
    print(f"  - tmp/redirected_links.txt")
    print(f"  - tmp/uncovered_links.txt")

    return len(uncovered_links) == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
