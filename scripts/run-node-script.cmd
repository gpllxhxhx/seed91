@echo off
setlocal

set "NODE_EXE=%npm_node_execpath%"
if defined NODE_EXE set "NODE_EXE=%NODE_EXE:"=%"
if not defined NODE_EXE set "NODE_EXE=node"

"%NODE_EXE%" %*
exit /b %ERRORLEVEL%
