#aliases
alias serial='picocom -b 115200 /dev/tty.SLAB_USBtoUART'

#my scripts
alias gprp='sh ~/Documents/scripts/gprp.sh'
alias glom='sh ~/Documents/scripts/glom.sh'

#ignore diplicates
export HISTCONTROL=ignoredups

#android
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export PATH="$ANDROID_HOME/tools:$PATH"
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"

# zsh-completions
if [ -n "$ZSH_VERSION" ]; then
    if type brew &>/dev/null; then
        FPATH=$(brew --prefix)/share/zsh-completions:$FPATH
        autoload -Uz compinit
        compinit
    fi
fi

## [Completion]
## Completion scripts setup. Remove the following line to uninstall
[[ -f ~/.dart-cli-completion/zsh-config.zsh ]] && . ~/.dart-cli-completion/zsh-config.zsh || true
## [/Completion]

# Custom binaries
export PATH="$HOME/bin:$PATH"
export PATH="$HOME/.docker/bin:$PATH"
export PATH="$PATH":"$HOME/.pub-cache/bin"
