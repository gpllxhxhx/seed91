@echo off
setlocal

set ELECTRON_RUN_AS_NODE=
call "%~dp0run-node-script.cmd" "%~dp0desktop-dev.cjs"
exit /b %ERRORLEVEL%
