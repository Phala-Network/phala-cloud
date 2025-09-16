#!/usr/bin/env python3
"""
Extract all documentation links from docs.json navigation and redirects
"""
import json
import os
from typing import Set, List, Dict, Any

def extract_navigation_pages(nav_item: Any, pages: Set[str]):
    """Recursively extract page paths from navigation structure"""
    if isinstance(nav_item, str):
        pages.add(nav_item)
    elif isinstance(nav_item, dict):
        if "pages" in nav_item:
            for page in nav_item["pages"]:
                extract_navigation_pages(page, pages)
        # Handle group items
        for key, value in nav_item.items():
            if key != "pages" and key != "group":
                extract_navigation_pages(value, pages)
    elif isinstance(nav_item, list):
        for item in nav_item:
            extract_navigation_pages(item, pages)

def extract_redirect_links(redirects: List[Dict[str, str]]) -> Set[str]:
    """Extract all source and destination paths from redirects"""
    links = set()
    for redirect in redirects:
        links.add(redirect["source"])
        links.add(redirect["destination"])
    return links

def main():
    # Read docs.json
    with open('docs.json', 'r') as f:
        docs_config = json.load(f)

    all_links = set()

    # Extract from navigation
    navigation = docs_config.get("navigation", {})

    # Extract from anchors
    anchors = navigation.get("anchors", [])
    for anchor in anchors:
        groups = anchor.get("groups", [])
        for group in groups:
            extract_navigation_pages(group, all_links)

    # Extract from global navigation
    global_nav = navigation.get("global", {})
    if "anchors" in global_nav:
        for anchor in global_nav["anchors"]:
            if "href" in anchor and anchor["href"].startswith("/"):
                all_links.add(anchor["href"])

    # Extract from redirects
    redirects = docs_config.get("redirects", [])
    redirect_links = extract_redirect_links(redirects)
    all_links.update(redirect_links)

    # Filter out external links and clean paths
    internal_links = set()
    for link in all_links:
        if link.startswith("/") or not link.startswith("http"):
            # Remove leading slash for file system checks
            clean_link = link.lstrip("/")
            if clean_link:  # Skip empty strings
                internal_links.add(clean_link)

    # Sort for better readability
    sorted_links = sorted(internal_links)

    print(f"Found {len(sorted_links)} internal documentation links:")
    print("=" * 60)

    for link in sorted_links:
        print(link)

    # Save to file for further processing
    with open('tmp/extracted_links.txt', 'w') as f:
        for link in sorted_links:
            f.write(f"{link}\n")

    print(f"\nLinks saved to tmp/extracted_links.txt")

if __name__ == "__main__":
    main()
