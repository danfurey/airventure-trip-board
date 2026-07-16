$ErrorActionPreference = "Stop"

Write-Host "Removing the old Supabase install and generated dependencies..."
Remove-Item package-lock.json -Force -ErrorAction SilentlyContinue
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item supabase -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item src\lib\supabase.js -Force -ErrorAction SilentlyContinue

Write-Host "Using the public npm registry..."
npm config set registry https://registry.npmjs.org/

Write-Host "Installing Firebase version of the app..."
npm install
npm run build

Write-Host "Firebase conversion installed successfully. Run 'npm run dev' to test locally."
