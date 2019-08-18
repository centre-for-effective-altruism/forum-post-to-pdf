const {ECS_CLUSTER_NAME, ECS_TASK_DEFINITION, ECS_CONTAINER_NAME, AWS_SUBNET, VPC_SECURITY_GROUP_ID} = process.env
const {S3, ECS} = require('aws-sdk')
const promiseRetry = require('promise-retry');
const crypto = require('crypto');

const s3 = new S3()
const ecs = new ECS()


const handler = async (event, context) => {
    console.log(`ENV: `, ECS_CLUSTER_NAME, ECS_CONTAINER_NAME, ECS_TASK_DEFINITION)
    const markdownFile = getMarkdownFile(event)
    const key = `${getFileHash(markdownFile)}.md`
    await uploadMDFile({ key, data: markdownFile })
    console.info(`${key} was added to S3 bucket`)
    const {tasks} = await startECSTask(key)
    const {taskArn} = tasks[0]
    console.info(`Polling ${taskArn}`)
    await isTaskStopped(taskArn)
}

const getFileHash = fileData => crypto.createHash('sha1').update(fileData).digest('hex')

const getMarkdownFile = ({title, author, createdAt, updatedAt, body}) => `
% ${title}
% ${author}
% ${getDate(createdAt)}${updatedAt ? ` (last updated ${getDate(updatedAt)})` : ''}

${body}
`

const getDate = dateString => {
    const date = Date.parse(dateString)
    const formatter = Intl.DateTimeFormat()
    return new Intl.DateTimeFormat('en-US').format(date)
}

const uploadMDFile = ({key, data}) => s3.upload({
    Bucket: 'ea-forum-public',
    Body: data,
    Key: key
}).promise()

const startECSTask = async key => ecs.runTask({
    cluster: ECS_CLUSTER_NAME,
    taskDefinition: ECS_TASK_DEFINITION,
    overrides: {
        containerOverrides: [{
            name: ECS_CONTAINER_NAME,
            command: [key]
        }]
    },
    networkConfiguration: {
        awsvpcConfiguration: {
            securityGroups: [VPC_SECURITY_GROUP_ID],
            subnets: [AWS_SUBNET]
        }
    },
    launchType: 'FARGATE'
}).promise()

const isTaskStopped = taskArn => promiseRetry(async (retry, number) => {
    try {
        const res = await ecs.describeTasks({
            cluster: ECS_CLUSTER_NAME,
            tasks: [taskArn]
        }).promise()
        console.log(res)
        const {lastStatus} = res.tasks[0]
        if (lastStatus !== 'STOPPED') throw new Error(`Task status is ${lastStatus}`)
    } catch (err) {
        console.warn(`Polling attempt ${number}: ${err.message}`)
        retry(err)
    }
})


// const testEvent = {
//     "title": "A Truly Dope PDF File",
//     "author": "Sam Deere and Oli Habryka",
//     "createdAt": "2019-07-19Z19:00:00",
//     "updatedAt": "2019-07-19Z19:00:00",
//     "body": "Synopsis\n========\n\n`pandoc` [*options*] [*input-file*]...\n\nDescription\n===========\n\nPandoc is a [Haskell] library for converting from one markup format to\nanother, and a command-line tool that uses this library.\n\nPandoc can convert between numerous markup and word processing formats,\nincluding, but not limited to, various flavors of [Markdown], [HTML],\n[LaTeX] and [Word docx]. For the full lists of input and output formats,\nsee the `--from` and `--to` [options below][General options].\nPandoc can also produce [PDF] output: see [creating a PDF], below.\n\nPandoc's enhanced version of Markdown includes syntax for [tables],\n[definition lists], [metadata blocks], [footnotes], [citations], [math],\nand much more.  See below under [Pandoc's Markdown].\n\nPandoc has a modular design: it consists of a set of readers, which parse\ntext in a given format and produce a native representation of the document\n(an _abstract syntax tree_ or AST), and a set of writers, which convert\nthis native representation into a target format. Thus, adding an input\nor output format requires only adding a reader or writer. Users can also\nrun custom [pandoc filters] to modify the intermediate AST.\n\nBecause pandoc's intermediate representation of a document is less\nexpressive than many of the formats it converts between, one should\nnot expect perfect conversions between every format and every other.\nPandoc attempts to preserve the structural elements of a document, but\nnot formatting details such as margin size.  And some document elements,\nsuch as complex tables, may not fit into pandoc's simple document\nmodel.  While conversions from pandoc's Markdown to all formats aspire\nto be perfect, conversions from formats more expressive than pandoc's\nMarkdown can be expected to be lossy."
// }

// ; (async () => {
//     console.log(`Running`)
//     const markdownFile = getMarkdownFile(testEvent)
//     const fileName = `${getFileHash(markdownFile)}.md`
//     console.log(markdownFile)
//     console.log(fileName)
// })()

module.exports = {handler}