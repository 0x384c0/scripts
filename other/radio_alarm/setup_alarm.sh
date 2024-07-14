# dependecies
sudo apt-get install tmux ffmpeg

# alarm
CRON_LINE="0 7 * * * sh $PWD/start_radio_session.sh"
echo "$CRON_LINE"
(crontab -u $(whoami) -l; echo "$CRON_LINE" ) | crontab -u $(whoami) -
crontab -e

# aliases
touch ~/.bash_aliases

echo "alias vold='sh $PWD/volume_down.sh'" >> ~/.bash_aliases
echo "alias volu='sh $PWD/volume_up.sh'" >> ~/.bash_aliases