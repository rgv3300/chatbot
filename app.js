const 
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express()
    fs = require('fs')
const port = process.env.PORT || 3000

app.use(bodyParser.json())   //body parser middleware

//webhook endpoing
app.post('/webook', (req,res) => {
    let body = req.body

    console.log(body)
    res.status(200).send('Event received')
})

//token verification
app.get('/webhook',(req,res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN

    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']

    if(token) {
        if(token == VERIFY_TOKEN) {
            console.log('verified')
            res.status(200)
        } else {
            res.sendStatus(403)
        }
    }
})


app.get('/',(req,res) => {
    res.send('hello world')
})

app.listen(port, () => {
    console.log('Hello world!')
})