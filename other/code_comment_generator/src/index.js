let CommentsGenerator = require('./CommentsGenerator.js')

let filePath = process.argv[2]

CommentsGenerator = CommentsGenerator.CommentsGenerator

let patterns = {
    func: /(\n((?! *\*\/).)*)(\n.* *fun\s+([a-zA-Z]+)\()/,
    class: /(\n((?! *\*\/).)*)(\n.* *class\s+([a-zA-Z]+)\s+\:)/,
    funcDictionary: {
        "onViewCreated": "Стандартный метод Android. Вызывается после того как layout проинициализирован",
        "onCreateView": "Стандартный метод Android. Вызывается в момент создания View и в нём инициализируется layout"
    }
}

async function main(){
    let generator = new CommentsGenerator(patterns)
    await generator.generateComments(filePath)
}

main()