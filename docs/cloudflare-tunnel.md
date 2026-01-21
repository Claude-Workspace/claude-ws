# Cloudflare Tunnel Setup

Access Claude Workspace securely from anywhere using Cloudflare Tunnel + Access.

## 1. Install cloudflared

```bash
# macOS
brew install cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

# Windows
winget install Cloudflare.cloudflared
```

## 2. Authenticate

```bash
cloudflared tunnel login
```

## 3. Create Tunnel

```bash
cloudflared tunnel create claude-workspace
```

## 4. Configure

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: claude-workspace
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: claude-ws.yourdomain.com
    service: http://localhost:8556
  - service: http_status:404
```

## 5. Add DNS Record

```bash
cloudflared tunnel route dns claude-workspace claude-ws.yourdomain.com
```

## 6. Run Tunnel

```bash
# Foreground
cloudflared tunnel run claude-workspace

# Or as service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 7. Setup Cloudflare Access (Optional)

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** → **Applications** → **Add an application**
3. Select **Self-hosted**, configure:
   - **Application domain**: `claude-ws.yourdomain.com`
   - **Policy**: Allow specific emails or email domains
4. Save and deploy

Now access `https://claude-ws.yourdomain.com` from anywhere with authentication.
