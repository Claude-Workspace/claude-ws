# Quick Reference: Server Address Configuration

## How to Specify Full Server Address

### In Swagger UI (Easiest)

1. Open http://localhost:3000/docs/swagger
2. Click the server dropdown at the top
3. Select **"Custom full server address"**
4. Enter your **complete URL including protocol**:

```
https://api.example.com:8443
```

That's it! The full address with protocol.

## Examples by Protocol

### HTTPS (Production/Secure)

```
https://api.yourcompany.com:8443
https://staging-api.example.com:9443
https://production.example.com
https://api.example.com
https://your-domain.com:8443
```

### HTTP (Development/Testing)

```
http://localhost:3000
http://localhost:8000
http://192.168.1.100:3000
http://api.example.com:8080
http://10.0.0.50:8080
```

## Common Patterns

### Local Development
```
http://localhost:3000
http://localhost:8000
http://localhost:9000
```

### Local Network (from other devices)
```
http://192.168.1.100:3000
http://192.168.1.50:8000
http://10.0.0.5:3000
```

### Production with Custom Port
```
https://api.example.com:8443
https://api.mycompany.com:9443
https://production-api.example.com:8443
```

### Production Default Port (443)
```
https://api.example.com
https://api.yourcompany.com
```

### Staging Environment
```
https://staging-api.example.com:8443
https://staging.example.com:9443
http://staging.example.com:8080
```

## Using Helper Script

```bash
# HTTPS with custom port
./scripts/update-swagger-server.sh https://api.example.com:8443

# HTTP on local network
./scripts/update-swagger-server.sh http://192.168.1.100:3000

# HTTPS production (default port)
./scripts/update-swagger-server.sh https://api.example.com

# HTTP localhost with custom port
./scripts/update-swagger-server.sh http://localhost:8000
```

The script automatically detects the protocol from your input.

## URL Format Breakdown

```
protocol://domain:port
│         │       │
│         │       └── Optional port (default: 443 for https, 80 for http)
│         └────────── Domain name or IP address
└───────────────────── http or https
```

## Quick Decision Guide

| Environment | Protocol | Example |
|-------------|----------|---------|
| Local Dev | http | `http://localhost:3000` |
| Team Testing | http | `http://192.168.1.100:3000` |
| Staging | https | `https://staging-api.example.com:8443` |
| Production | https | `https://api.example.com:8443` |
| Production (std port) | https | `https://api.example.com` |

## Testing Your Configuration

After setting your server:

```bash
# Test if server is accessible
curl https://api.example.com:8443/api/projects

# Or with insecure flag for self-signed certs
curl -k https://192.168.1.100:8443/api/projects
```

## Remember

✅ Always include the protocol (http:// or https://)  
✅ Include the port if non-standard  
✅ Use https for production  
✅ Use http for development  

---
**Full Guide:** [CHANGE_SERVER.md](CHANGE_SERVER.md)
