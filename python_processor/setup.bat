@echo off
REM ============================================
REM Document Processor Setup Script
REM ============================================

echo.
echo ============================================
echo   Document Processor - Python Setup
echo ============================================
echo.

REM Check Python installation
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10 or later from https://www.python.org/
    pause
    exit /b 1
)

echo [1/4] Checking Python version...
python --version

REM Create virtual environment
echo.
echo [2/4] Creating virtual environment...
if exist "venv" (
    echo Virtual environment already exists
) else (
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo.
echo [3/4] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo.
echo [4/4] Installing dependencies...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo To start the server, run:
echo   venv\Scripts\activate
echo   python main.py server
echo.
echo To process a single file:
echo   venv\Scripts\activate
echo   python main.py process /path/to/file.pdf --category 1
echo.
echo To validate configuration:
echo   venv\Scripts\activate
echo   python main.py validate
echo.
echo ============================================
echo.

pause
