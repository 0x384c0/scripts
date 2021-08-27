CRON_LINE="0 3 * * * sh $PWD/start_radio_session.sh"
echo "$CRON_LINE"
(crontab -u $(whoami) -l; echo "$CRON_LINE" ) | crontab -u $(whoami) -
crontab -e