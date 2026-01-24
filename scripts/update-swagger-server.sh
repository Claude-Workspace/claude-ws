#!/bin/bash
# Helper script to update Swagger server address
# Usage: ./scripts/update-swagger-server.sh <full-server-address>
#
# Examples:
#   ./scripts/update-swagger-server.sh https://api.example.com:8443
#   ./scripts/update-swagger-server.sh http://192.168.1.100:3000
#   ./scripts/update-swagger-server.sh localhost:8000

SERVER_URL=$1

if [ -z "$SERVER_URL" ]; then
    echo "❌ Error: Server address required"
    echo ""
    echo "Usage: $0 <server-address>"
    echo ""
    echo "Examples:"
    echo "  $0 https://api.example.com:8443"
    echo "  $0 http://192.168.1.100:3000"
    echo "  $0 localhost:8000"
    exit 1
fi

# Add protocol if not specified
if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
    if [[ "$SERVER_URL" =~ :[0-9]+$ ]]; then
        # Has port, assume http
        SERVER_URL="http://$SERVER_URL"
    else
        # No port, assume https for production
        SERVER_URL="https://$SERVER_URL"
    fi
fi

echo "🔄 Updating Swagger server configuration..."
echo "Server URL: $SERVER_URL"
echo ""

# Update production server in both files
sed -i "s|  - url: https://example.com:8443|  - url: $SERVER_URL|g" public/docs/swagger/swagger.yaml
sed -i "s|  - url: https://example.com:8443|  - url: $SERVER_URL|g" docs/swagger/swagger.yaml

# Update description
sed -i 's|description: Production server (replace with your domain)|description: Production server|g' public/docs/swagger/swagger.yaml
sed -i 's|description: Production server (replace with your domain)|description: Production server|g' docs/swagger/swagger.yaml

echo "✅ Server address updated successfully!"
echo ""
echo "Updated files:"
echo "  - public/docs/swagger/swagger.yaml"
echo "  - docs/swagger/swagger.yaml"
echo ""
echo "📖 Usage:"
echo "  1. Start dev server: npm run dev"
echo "  2. Open: http://localhost:3000/docs/swagger"
echo "  3. Select '$SERVER_URL' from the server dropdown"
echo ""
echo "Or test API directly:"
if [[ "$SERVER_URL" =~ ^https ]]; then
    echo "  curl -k $SERVER_URL/api/projects"
else
    echo "  curl $SERVER_URL/api/projects"
fi
