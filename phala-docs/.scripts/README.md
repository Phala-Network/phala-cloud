# Phala Docs Scripts

## Precommit checks

```bash
# Check historical links are not broken
python3 .scripts/check_links.py
# Check if all the redirects are handled properly
python3 .scripts/validate-redirects.py
```

When a new page is added, we should always update used\_links to include it.
