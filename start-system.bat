@echo off
echo ========================================
echo Starting EOB Extraction System
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
)

if not exist "client\node_modules" (
    echo Installing frontend dependencies...
    cd client
    call npm install
    cd ..
)

REM Create required directories
if not exist "uploads" mkdir uploads
if not exist "results" mkdir results
if not exist "temp" mkdir temp
if not exist "logs" mkdir logs

echo.
echo ========================================
echo Starting Backend Server...
echo ========================================
start "EOB Backend" cmd /k "npm run dev"

timeout /t 3

echo.
echo ========================================
echo Starting Frontend...
echo ========================================
start "EOB Frontend" cmd /k "cd client && npm start"

echo.
echo ========================================
echo System Starting...
echo ========================================
echo.
echo Backend will be available at: http://localhost:5000
echo Frontend will be available at: http://localhost:3000
echo.
echo Login credentials:
echo   Email: admin@eob.com
echo   Password: Admin123!
echo.
echo Press any key to exit this window (servers will keep running)...
pause > nul
