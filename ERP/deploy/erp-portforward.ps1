# ERP WSL2 Port Forwarding Script
# Chay khi khoi dong Windows de dan traffic vao WSL
# Luu tai: C:\erp-portforward.ps1
# Chay voi quyen Admin

# Lay IP hien tai cua WSL
$wslIp = (wsl hostname -I).Trim().Split()[0]
Write-Host "WSL IP: $wslIp"

if (-not $wslIp) {
    Write-Host "Khong lay duoc IP cua WSL. Dang khoi dong WSL..."
    wsl -e bash -c "echo WSL started"
    Start-Sleep -Seconds 5
    $wslIp = (wsl hostname -I).Trim().Split()[0]
}

if (-not $wslIp) {
    Write-Host "LOI: Khong the lay IP WSL. Kiem tra WSL da cai chua."
    exit 1
}

# Xoa rule cu (neu co)
netsh interface portproxy delete v4tov4 listenport=80   listenaddress=0.0.0.0 2>$null
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0 2>$null

# Tao port forward moi: Windows:80 -> WSL:80
netsh interface portproxy add v4tov4 `
    listenport=80 listenaddress=0.0.0.0 `
    connectport=80 connectaddress=$wslIp

Write-Host "Port forwarding: 0.0.0.0:80 -> ${wslIp}:80"

# Mo Firewall Windows cho port 80
netsh advfirewall firewall delete rule name="WSL ERP Port 80"  2>$null
netsh advfirewall firewall add rule `
    name="WSL ERP Port 80" `
    dir=in action=allow `
    protocol=TCP localport=80

Write-Host "Firewall rule added for port 80"

# Khoi dong services trong WSL
Write-Host "Starting WSL services..."
wsl -e bash -c "sudo systemctl start nginx erp-backend cloudflared 2>/dev/null; echo 'Services started'"

Write-Host ""
Write-Host "=== KIEM TRA ==="
netsh interface portproxy show v4tov4
Write-Host "=== HOAN TAT ==="
