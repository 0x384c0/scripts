parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )

IFS=$'\n'
files=($(git diff --name-only develop | grep -E "\.kt$"))

for file in "${files[@]}"
do
    sh $parent_path"/run.sh" $file
done