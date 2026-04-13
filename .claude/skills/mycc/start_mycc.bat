@echo off
chcp 65001 >nul
echo === 启动 MyCC 后端 ===
cd /d "%~dp0scripts"
npx tsx src/index.ts start
pause
