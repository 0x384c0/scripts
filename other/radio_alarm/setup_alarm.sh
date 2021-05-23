echo "0 3 * * * sh $PWD/start_radio_session.sh" | xsel -b
EDITOR=nano crontab -e