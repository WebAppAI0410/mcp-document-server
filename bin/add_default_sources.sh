#!/bin/bash

# Default documentation sources based on requirements
echo "Adding default documentation sources..."

# Check if server is running
if ! curl -s http://localhost:6111/healthz > /dev/null; then
    echo "Error: MCP server is not running. Please start the server first."
    exit 1
fi

# Add Next.js documentation
echo "Adding Next.js 14.2.2 documentation..."
npm run add-source -- next 14.2.2 https://nextjs.org/docs \
    --preset nextjs \
    --sitemap https://nextjs.org/sitemap.xml \
    --max-pages 200

# Add React documentation
echo "Adding React 18.3.0 documentation..."
npm run add-source -- react 18.3.0 https://react.dev/learn \
    --preset react \
    --max-pages 150

# Add React Native documentation
echo "Adding React Native 0.74 documentation..."
npm run add-source -- react-native 0.74.0 https://reactnative.dev/docs \
    --preset reactNative \
    --sitemap https://reactnative.dev/sitemap.xml \
    --max-pages 100

# Add Convex documentation
echo "Adding Convex 1.6.0 documentation..."
npm run add-source -- convex 1.6.0 https://docs.convex.dev \
    --preset convex \
    --max-pages 100

# Add Cloudflare Workers documentation
echo "Adding Cloudflare Workers documentation..."
npm run add-source -- cloudflare-workers 2025-05 https://developers.cloudflare.com/workers \
    --preset cloudflare \
    --max-pages 100

# Add Expo documentation
echo "Adding Expo 50 documentation..."
npm run add-source -- expo 50.0.0 https://docs.expo.dev \
    --preset expo \
    --max-pages 100

# Add Clerk documentation
echo "Adding Clerk 4.20 documentation..."
npm run add-source -- clerk 4.20.0 https://clerk.com/docs \
    --preset clerk \
    --max-pages 100

# Add Stripe documentation
echo "Adding Stripe 2025-05-15 documentation..."
npm run add-source -- stripe 2025-05-15 https://stripe.com/docs/api \
    --preset stripe \
    --max-pages 150

# Add Python documentation
echo "Adding Python 3.12 documentation..."
npm run add-source -- python 3.12 https://docs.python.org/3.12/ \
    --preset python \
    --max-pages 200

echo "Default documentation sources added successfully!"
echo "You can verify by visiting http://localhost:6111/v1/packages"