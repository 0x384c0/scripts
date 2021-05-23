const googleTranslate = require('@vitalets/google-translate-api');
var fs = require('fs');
const util = require('util');


/**
 * This is the CommentGenerator class.
 *
 * @class
 */
class CommentsGenerator {

    constructor(patterns){
        this.patterns = patterns
    }

    async translate(text) {
        return googleTranslate(text, {
            from: 'en',
            to: 'ru'
        })
            .then(res => res.text)
    }

    async readFile(filePath) {
        let data = '';
        // Convert fs.readFile into Promise version of same    
        const readFile = util.promisify(fs.readFile);
        return readFile(filePath, 'utf8')
    }

    async overWriteFile(filePath, data) {
        const writeFile = util.promisify(fs.writeFile);
        return writeFile(filePath, data, { encoding: 'utf8', flag: 'w' })
    }

    replaceAll(str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
    }


    async generateComments(filePath) {


        let commentKey = ' COMMENT'
        let replacePattern = `$1\n/**\n*${commentKey} $4 \n*/$3`
        let untranslatedRegex = new RegExp(`${commentKey} ([a-zA-Z]+)`, "g")
        let patterns = this.patterns

        //read file
        console.log(`reading file ${filePath}`)
        let data = await this.readFile(filePath)

        //mark places for comment generation
        data = this.replaceAll(data, patterns.func, replacePattern)
        data = this.replaceAll(data, patterns.class, replacePattern)
        let foudItems = data.match(untranslatedRegex)
        if (foudItems == null)
            foudItems = 0
        else
            foudItems = foudItems.length
        console.log(`found ${foudItems} items for commenting`)
        if (foudItems == 0)
            console.log("Nothing to do")
        else {
            //translate comments from local dictionary
            for (let key in patterns.funcDictionary) {
                data = this.replaceAll(data, `${commentKey} ${key}`, ` ${patterns.funcDictionary[key]}`)
            }

            //translate comments from remote dictionary
            let dataForTranslate = data
                .match(untranslatedRegex)
                .map(str => { return { key: str, value: str.replace(untranslatedRegex, '$1') } })
                .map(pair => {
                    pair.value = this.replaceAll(pair.value, /([A-Z])/, ` $1`) //split camel-case syntax words
                    return pair
                })

            let translatedStrings = await this.translate(dataForTranslate.map(pair => pair.value).join(`\n`))
            translatedStrings = translatedStrings.split(/\r?\n/)

            dataForTranslate.forEach((pair, i) => {
                pair.value = ` ${translatedStrings[i]}`
                data = data.replace(pair.key, pair.value)
            })

            //write file
            console.log(`writing file ${filePath}`)
            await this.overWriteFile(filePath, data)
        }
        console.log('Finished')
    }
}

module.exports = {
    CommentsGenerator:CommentsGenerator
}