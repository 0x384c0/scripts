#aliases
alias adb='~/Library/Android/sdk/platform-tools/adb'
alias nginx='/usr/local/Cellar/nginx-full/1.10.1/bin/nginx'
alias links='links "https://www.google.com/?hl=en"'
alias rffplay='ffplay -user-agent "Mozilla/5.0"  -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2'
#my scripts
alias gprp='sh ~/Documents/scripts/gprp.sh' 
alias glom='sh ~/Documents/scripts/glom.sh' 
alias ghdl='sh ~/Documents/scripts/github-downloader.sh'
alias animedl='sh ~/Documents/scripts/anime_spirit_downloader.sh'
alias ncserver='sh ~/Documents/scripts/ncserver.sh'
alias ytplay='sh ~/Documents/scripts/ytplay.sh'
alias ocplay='sh ~/Documents/scripts/oc_kg_ffplay.sh'
#ignore diplicates
export HISTCONTROL=ignoredups
#bash completion
if [ -f $(brew --prefix)/etc/bash_completion ]; then
  . $(brew --prefix)/etc/bash_completion
fi

#python 
alias python=python3
alias pip="python3 -m pip"

#rvm
source ~/.rvm/scripts/rvm
#brew
export PATH="/usr/local/sbin:$PATH" #ADDED BY 010 EDITOR
export PATH="$PATH:/Applications/010 Editor.app/Contents/CmdLine"
