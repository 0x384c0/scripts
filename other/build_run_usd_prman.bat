set OPEN_USD_INSTALL_PATH=USD\

echo "Get OpenUSD"
git clone git@github.com:PixarAnimationStudios/OpenUSD.git

echo "Setup envirronment"
python -m venv "venv"
venv\Scripts\activate.bat
pip install pyside6
pip install PyOpenGL PyOpenGL_accelerate

echo "Build"
python "OpenUSD\build_scripts\build_usd.py" --ptex --openimageio --opencolorio --openvdb --prman --prman-location "$env:RMANTREE" "USD"

echo "Environment variables"
set PATH=%PATH%;%OPEN_USD_INSTALL_PATH%bin
set PATH=%PATH%;%OPEN_USD_INSTALL_PATH%lib
set PYTHONPATH=F:\hdprman\USD\lib\python
set RMAN_SHADERPATH=%RMANTREE%lib\shaders;%OPEN_USD_INSTALL_PATH%plugin\usd\resources\shaders
set RMAN_RIXPLUGINPATH=%OPEN_USD_INSTALL_PATH%lib\plugins
set RMAN_TEXTUREPATH=%RMANTREE%lib\textures;%RMANTREE%lib\plugins;%OPEN_USD_INSTALL_PATH%plugin\usd

echo "Test"
usdview "OpenUSD\extras\usd\tutorials\referencingLayers\HelloWorld.usda"
@REM usdrecord --complexity "veryhigh" --colorCorrectionMode "openColorIO" --frames "1:240" --renderer "Prman" --camera "/cameras/camera1" "../hou_temp/usd/ropusd_prman_landscape/ropusd_prman_landscape.usd" "/output/out.###.exr"
pause
