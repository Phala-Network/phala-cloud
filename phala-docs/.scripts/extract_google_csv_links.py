#!/usr/bin/env python3
"""
Extract links from Google Search Console CSV files and save them for link checking.
Reads all CSV files from tmp/google-csv/ and extracts target page URLs.
"""
import csv
import os
from pathlib import Path
from urllib.parse import urlparse

def extract_links_from_csv(csv_file_path: str) -> list:
    """Extract target page URLs from a Google Search Console CSV file"""
    links = []

    try:
        with open(csv_file_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # Google Search Console CSV typically has "Target page" or "URL" column
                url = None
                if 'Target page' in row:
                    url = row['Target page'].strip()
                elif 'URL' in row:
                    url = row['URL'].strip()

                if url:
                    # Parse URL to get just the path
                    parsed = urlparse(url)
                    path = parsed.path.lstrip('/')
                    if path:
                        links.append(path)
    except Exception as e:
        print(f"Error reading {csv_file_path}: {e}")

    return links

def main():
    # Directory containing Google CSV files
    csv_dir = Path('tmp/google-csv')

    if not csv_dir.exists():
        print(f"Directory {csv_dir} does not exist")
        return

    # Find all CSV files
    csv_files = list(csv_dir.glob('*.csv'))

    if not csv_files:
        print(f"No CSV files found in {csv_dir}")
        return

    print(f"Found {len(csv_files)} CSV files:")
    for csv_file in csv_files:
        print(f"  - {csv_file.name}")

    # Extract links from all CSV files
    all_links = set()

    for csv_file in csv_files:
        print(f"\nProcessing {csv_file.name}...")
        links = extract_links_from_csv(csv_file)
        print(f"  Extracted {len(links)} links")
        all_links.update(links)

    # Remove empty links and sort
    all_links = sorted([link for link in all_links if link])

    print(f"\nTotal unique links extracted: {len(all_links)}")

    # Ensure output directory exists
    output_dir = Path('.scripts/used_links')
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save to output file
    output_file = output_dir / 'google-search-console.txt'
    with open(output_file, 'w') as f:
        for link in all_links:
            f.write(f"{link}\n")

    print(f"\nLinks saved to: {output_file}")

    # Show first 10 links as preview
    if all_links:
        print(f"\nFirst 10 links:")
        for i, link in enumerate(all_links[:10]):
            print(f"  {i+1}. {link}")

        if len(all_links) > 10:
            print(f"  ... and {len(all_links) - 10} more")

if __name__ == "__main__":
    main()
