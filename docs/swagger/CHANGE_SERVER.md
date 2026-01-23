# How to Change Server Address in Swagger Documentation

## Quick Start

The Swagger documentation supports multiple server addresses. When you open http://localhost:3000/docs/swagger, you'll see a server dropdown at the top of the page where you can select from predefined servers or enter a custom address.

## Available Server Options

### 1. Local Development (Default)
- **URL:** `http://localhost:3000`
- **Use for:** Local development

### 2. Alternative Local Port
- **URL:** `http://localhost:3001`
- **Use for:** When running on a different port

### 3. Local Network Server
- **URL:** `http://192.168.1.100:3000`
- **Use for:** Access from other devices on your network
- **Note:** Change the IP to your machine's local network IP

### 4. Production Server
- **URL:** `https://example.com:8443`
- **Use for:** Production or staging environments
- **Note:** Replace with your actual domain

### 5. Custom Full Server Address
- **URL:** `http://{server}`
- **Variable:** `server` (default: "localhost:3000")
- **Use for:** Any custom server address
- **Examples:**
  - `api.example.com:8443`
  - `192.168.1.50:8000`
  - `localhost:9000`

## How to Change Server

### Method 1: Use Swagger UI (Easiest)

1. Open http://localhost:3000/docs/swagger
2. Find the server dropdown at the top of the page
3. Click to see available servers
4. Select your desired server from the list
5. Or select "Custom full server address" and enter:
   - `api.example.com:8443`
   - `192.168.1.100:3000`
   - Or any other full server address

### Method 2: Edit the Swagger YAML File

```bash
# Edit either file
nano public/docs/swagger/swagger.yaml
# or
nano docs/swagger/swagger.yaml
```

Find the `servers` section and update:

```yaml
servers:
  - url: https://api.yourdomain.com:8443
    description: Your production server
  - url: http://localhost:3000
    description: Local development
```

### Method 3: Use the Helper Script

```bash
# Update to a full server address
./scripts/update-swagger-server.sh https://api.example.com:8443

# Update to a local network server
./scripts/update-swagger-server.sh 192.168.1.100:3000

# Update to localhost with different port
./scripts/update-swagger-server.sh localhost:8000
```

The script will:
- Automatically add protocol (http/https) if not specified
- Update both YAML files
- Show usage instructions

## Common Scenarios

### Access from Mobile Device on Local Network

1. **Find your local IP:**
   ```bash
   # Linux/Mac
   ipconfig getifaddr en0
   # or
   hostname -I | awk '{print $1}'
   ```

2. **Update the server:**
   - Method 1: Select "Local network server" and edit the URL
   - Method 2: Use helper script:
     ```bash
     ./scripts/update-swagger-server.sh 192.168.1.X:3000
     ```

3. **Access from mobile:**
   ```
   http://192.168.1.X:3000/docs/swagger
   ```

### Production Server with Custom Domain and Port

```bash
./scripts/update-swagger-server.sh https://api.yourcompany.com:8443
```

This will update the production server entry to your custom domain and port.

### Development on Different Port

```bash
./scripts/update-swagger-server.sh localhost:8000
```

### Staging Environment

```yaml
servers:
  - url: https://staging-api.example.com:8443
    description: Staging server
```

## Full Server Address Format

The custom server variable accepts the full address in any of these formats:

- **Domain with port:** `api.example.com:8443`
- **Local IP with port:** `192.168.1.100:3000`
- **Localhost with port:** `localhost:8000`
- **Subdomain with port:** `api.staging.example.com:8443`
- **IP with standard port:** `10.0.0.50:80`

## URL Protocol Support

Both HTTP and HTTPS are supported:

```yaml
# HTTP (development/testing)
http://localhost:3000
http://192.168.1.100:3000

# HTTPS (production)
https://api.example.com:8443
https://staging-api.example.com:8443
```

## Example Configurations

### Local Development Setup
```yaml
servers:
  - url: http://localhost:3000
    description: Local development
  - url: http://localhost:3001
    description: Alternative port
```

### Team Testing Setup
```yaml
servers:
  - url: http://localhost:3000
    description: Developer 1
  - url: http://192.168.1.100:3000
    description: Developer 2 machine
  - url: http://192.168.1.101:3000
    description: Developer 3 machine
```

### Multi-Environment Setup
```yaml
servers:
  - url: http://localhost:3000
    description: Development
  - url: https://staging-api.example.com:8443
    description: Staging
  - url: https://api.example.com:8443
    description: Production
```

### Custom Port Setup
```yaml
servers:
  - url: http://localhost:8000
    description: Development on port 8000
  - url: http://localhost:9000
    description: Alternative server on port 9000
```

## Testing Your Server Configuration

After changing the server:

1. **Verify the server is running:**
   ```bash
   curl http://localhost:3000/api/projects
   # or
   curl https://api.example.com:8443/api/projects
   ```

2. **Test in Swagger UI:**
   - Open http://localhost:3000/docs/swagger
   - Select your server from the dropdown
   - Try the "Try it out" feature with any endpoint

3. **Check network connectivity:**
   ```bash
   # Test local network access
   ping 192.168.1.100
   
   # Test if port is open
   nc -zv 192.168.1.100 3000
   ```

## Troubleshooting

### "Cannot GET /api/projects" Error

**Cause:** Server not running or wrong address  
**Fix:** 
```bash
# Verify server is running
npm run dev

# Check the port
lsof -i :3000
```

### "ERR_CONNECTION_REFUSED"

**Cause:** Server not accessible from your network  
**Fix:**
- Check firewall settings
- Ensure server is listening on 0.0.0.0 (not 127.0.0.1)
- Verify IP address is correct

### "Certificate Error" (HTTPS)

**Cause:** Self-signed certificate  
**Fix:**
- Development: Use HTTP instead
- Or accept the certificate in browser
- Production: Use valid SSL certificate

### Mixed Content Warning

**Cause:** Loading HTTP resources on HTTPS page  
**Fix:**
- Use HTTPS for production servers
- Or accept the risk in development

## Best Practices

1. **Development:** Use `http://localhost:3000`
2. **Testing:** Use `http://192.168.1.X:3000` for network testing
3. **Production:** Always use `https://` with valid SSL
4. **Standard Ports:**
   - HTTP: 80, 8000, 3000, 8080
   - HTTPS: 443, 8443, 9443

## Quick Reference

| Environment | URL Format | Example |
|-------------|------------|---------|
| Local Dev | `http://localhost:port` | `http://localhost:3000` |
| Network | `http://ip:port` | `http://192.168.1.100:3000` |
| Production | `https://domain:port` | `https://api.example.com:8443` |
| Staging | `https://subdomain:port` | `https://staging-api.example.com:8443` |

## Files Modified

- `public/docs/swagger/swagger.yaml` - Server configuration
- `docs/swagger/swagger.yaml` - Source configuration
- `scripts/update-swagger-server.sh` - Helper script

## Need More Help?

- Check the server dropdown in Swagger UI
- Review browser console for specific errors
- Verify server is accessible with `curl`
- Check firewall and network settings

---
**Last Updated:** 2025-01-23  
**OpenAPI Version:** 3.0.3
