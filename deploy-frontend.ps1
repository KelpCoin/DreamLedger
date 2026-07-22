# Deploy to Render via GitHub
git add deploy/ render.yaml
git commit -m "Frontend deployment: $((Get-Date -Format 'yyyy-MM-dd HH:mm'))"
git push origin main
