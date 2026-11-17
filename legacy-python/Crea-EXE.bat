@echo off
cd /d "%~dp0"
echo === Creo "Jesse's Archive.exe" (serve Python 3.9+ installato) ===
python -m venv .buildenv || goto :err
call .buildenv\Scripts\activate
python -m pip install -q -r requirements.txt -r requirements-build.txt || goto :err
pyinstaller --noconfirm --onefile --windowed --name "Jesse's Archive" --icon jesse_archive.ico --add-data "ui;ui" --add-data "jesse_archive.ico;." --hidden-import pystray._win32 jesse_archive.py || goto :err
copy /y "dist\Jesse's Archive.exe" "Jesse's Archive.exe" >nul
rmdir /s /q build dist .buildenv 2>nul
del "Jesse's Archive.spec" 2>nul
echo.
echo Fatto! Ora hai "Jesse's Archive.exe" in questa cartella.
echo Il vault verra' salvato nella cartella "dati" accanto all'exe.
pause
exit /b
:err
echo Qualcosa e' andato storto: copia il messaggio qui sopra e mandamelo.
pause
