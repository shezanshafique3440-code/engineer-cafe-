#!/usr/bin/env bash
# Run explicitly on the VPS after deployment. Never modifies unrelated timers.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Run as root on the VPS."; exit 1; fi
APP=/var/www/engineer-cafe
test -f "$APP/scripts/backup-cafe.sh"
if [ -e /etc/systemd/system/engineer-cafe-backup.service ] || [ -e /etc/systemd/system/engineer-cafe-backup.timer ]; then
  echo "Cafe backup timer already configured; inspect it before replacing."; exit 1
fi
cat > /etc/systemd/system/engineer-cafe-backup.service <<'UNIT'
[Unit]
Description=Engineer Cafe private database and uploads backup
After=docker.service
[Service]
Type=oneshot
User=root
Environment=PM2_HOME=/root/.pm2
WorkingDirectory=/var/www/engineer-cafe
ExecStart=/usr/bin/bash /var/www/engineer-cafe/scripts/backup-cafe.sh
UMask=0077
UNIT
cat > /etc/systemd/system/engineer-cafe-backup.timer <<'UNIT'
[Unit]
Description=Engineer Cafe daily backup at 04:00 Pakistan time
[Timer]
OnCalendar=*-*-* 04:00:00 Asia/Karachi
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemd-analyze verify /etc/systemd/system/engineer-cafe-backup.service /etc/systemd/system/engineer-cafe-backup.timer
systemctl daemon-reload
systemctl enable --now engineer-cafe-backup.timer
systemctl list-timers engineer-cafe-backup.timer --no-pager
