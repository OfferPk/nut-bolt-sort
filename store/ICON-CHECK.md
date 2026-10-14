# Play Store icon check (v1.5.0)

File: `store/icon-512.png`

| Requirement (Google Play) | Value | Result |
|---|---|---|
| 512 × 512 px | 512 × 512 | PASS |
| PNG format | PNG (RGB) | PASS |
| File size ≤ 1024 KB | 64 KB | PASS |
| Full-bleed square (Play applies its own rounding/shadow) | corner alpha [255, 255, 255, 255] | PASS |
| In-app icon matches | `www/icon.png` 512×512 | PASS |

Overall: PASS. Source: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
