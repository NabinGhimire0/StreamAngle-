# start_all.ps1

Write-Host "Starting Go Backend Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; go run main.go" -WindowStyle Normal

Write-Host "Starting Vite Frontend Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd multistream; npm run dev" -WindowStyle Normal

Write-Host "Starting ngrok tunnel..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 5173" -WindowStyle Normal

Write-Host "All services started!"
Write-Host "Check the new window running ngrok to find your public ngrok URL (e.g., https://<random-id>.ngrok-free.app)."
Write-Host "Open that URL on your phone cameras and other devices to connect!"
