#!/bin/bash

# Define version
VERSION="1.2"
ZIP_NAME="prediction-market-timezone-v$VERSION.zip"

echo "📦 Packaging version $VERSION..."

# Remove old zip
rm -f "$ZIP_NAME"

# Create zip excluding unnecessary files
zip -r "$ZIP_NAME" \
  manifest.json \
  content.js \
  popup.html \
  popup.js \
  images/ \
  -x "*.DS_Store" \
  -x "test_parser.js" \
  -x "README.md" \
  -x "PRIVACY_POLICY.md" \
  -x "build.sh"

echo "✅ Created $ZIP_NAME"
echo "👉 Upload this file to the Chrome Web Store Developer Dashboard."
