@echo off
cd /d "E:\prj\mycc\.claude\skills\mycc\scripts"
set "NODE_ENV=production"
for /f "tokens=*" %%a in ('type "E:\prj\mycc\.env" 2^>nul') do (
    set %%a
)
E:\prj\mycc\.claude\skills\mycc\scripts\node_modules\.bin\tsx src/index.ts start >> "E:\prj\mycc\.claude\skills\mycc\backend.log" 2>&1
