# Engineer Cafe menu image pack

35 distinct AI-generated, representative food images matched to the current menu. These are not photographs of actual cafe servings. Four category covers reuse their matching product photograph. Original generated PNGs are included without cropping or retouching.

Open `menu-preview.html` to review all images offline.

## Upload from Windows

Download `engineer-cafe-images.zip` into Downloads, then run in PowerShell:

```powershell
scp "$env:USERPROFILE\Downloads\engineer-cafe-images.zip" root@2.24.193.142:/root/
```

Enter the VPS SSH password at the SSH prompt, never in chat. If the file was saved elsewhere, use its actual path.

## Install in Hostinger web console

Use a new extraction directory; do not overwrite an existing image pack:

```bash
test ! -e /root/engineer-cafe-images && python3 -m zipfile -e /root/engineer-cafe-images.zip /root/engineer-cafe-images
bash /root/engineer-cafe-images/install.sh
```

The script targets only `/var/www/engineer-cafe` and the `engineer-cafe` PM2 process. It loads the existing `.env` without printing it, checks all 35 files and database products, copies images under the ignored `public/uploads/menu-photos-v1` directory, backs up old image paths and the production build under `/var/backups`, updates only product/category image fields, rebuilds all generated pages, restarts the app and verifies static images, homepage, menu and Nginx. No seed command runs; prices, orders, users and other settings are preserved.

Expect a few minutes of Engineer Cafe downtime during rebuilding. Other PM2 apps and Nginx configuration are not changed. If installation fails after the app stops, it attempts to restore the old image paths and build and restart Engineer Cafe. Keep the printed backup location.

The helper scripts have been syntax-checked locally; VPS installation and database/build rollback have not been executed by the assistant. Run the installer and share its output, excluding credentials, to complete deployment verification.

## Later reseeding

The repository seed still contains the original SVG illustration paths. Keep `SEED_ONLY_IF_EMPTY=true`; do not force reseeding a populated production database, as that can replace image paths and other menu edits.

## Manual rollback after a successful install

Use the exact backup directory printed by the installer. This changes image paths only, and refuses to overwrite intervening image edits:

```bash
export PATH="/opt/node22/bin:$PATH"
cd /var/www/engineer-cafe
set -a
source .env
set +a
node /root/engineer-cafe-images/update-images.cjs rollback /var/backups/EXACT-BACKUP-DIRECTORY/images.json
```

Then rebuild and restart Engineer Cafe so generated pages reflect the restored paths. Keep both builds until verification is complete.
