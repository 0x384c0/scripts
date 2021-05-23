set -e
usage () {
  echo "USAGE: sh deploy_to_cocoapods.sh \"1.1.1\""
  exit
}

VERSION=$1
[ -e $VERSION ] || usage

git add -A && git commit --allow-empty -m "Release $VERSION."
git tag "$VERSION"
git push
git push --tags
pod trunk push *.podspec
echo "Deployed to cocoapods with version - $VERSION"