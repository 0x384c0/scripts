# check errors
set -e
WRONG_COMMIT_MESSAGE="WRITE_COMMIT_MESSAGE"
LAST_COMMIT_MESSAGE=$(git log -1 --pretty=%B)

if [[ $LAST_COMMIT_MESSAGE == *"$WRONG_COMMIT_MESSAGE"* ]] 
	then
	echo "ERROR:"
	echo "$LAST_COMMIT_MESSAGE"
	exit 125
fi

if [ ! -f Podfile ]; then
    echo "Not ios directory"
    exit 125
fi


# push
git pull --rebase
git push
git commit --allow-empty -m $WRONG_COMMIT_MESSAGE

# echo $(git tag | tail -n 1) > VERSION
# git add VERSION
# git commit --amend --no-edit
# make set_version