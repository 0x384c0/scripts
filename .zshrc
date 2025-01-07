#aliases
alias ffpatched='~/Documents/mproj/FFmpeg_custom/FFmpeg/fftools/ffpatched'
alias rffplay='ffpatched -user_agent "Mozilla/5.0"  -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2'
#my scripts
alias gprp='sh ~/Documents/scripts/gprp.sh'
alias glom='sh ~/Documents/scripts/glom.sh'
alias ncserver='sh ~/Documents/scripts/ncserver.sh'
alias vlc='/Applications/VLC.app/Contents/MacOS/VLC'

#ignore diplicates
export HISTCONTROL=ignoredups

#android
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export PATH="$ANDROID_HOME/tools:$PATH"

# zsh-completions
if [ -n "$ZSH_VERSION" ]; then
    if type brew &>/dev/null; then
        FPATH=$(brew --prefix)/share/zsh-completions:$FPATH
        autoload -Uz compinit
        compinit
    fi
fi


# Add RVM to PATH for scripting. Make sure this is the last PATH variable change.
export PATH="$PATH:$HOME/.rvm/bin"
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
## [Completion]
## Completion scripts setup. Remove the following line to uninstall
[[ -f /Users/andrew/.dart-cli-completion/zsh-config.zsh ]] && . /Users/andrew/.dart-cli-completion/zsh-config.zsh || true
## [/Completion]

# Custom binaries
export PATH="$HOME/bin:$PATH"
export PATH="$HOME/.docker/bin:$PATH"
export PATH="$PATH":"$HOME/.pub-cache/bin"
