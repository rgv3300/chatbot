require('dotenv').config()

const express = require('express'),
    bodyParser = require('body-parser'),
    got = require('got'),
    app = express(),
    crypto = require('crypto')
    dayjs = require('dayjs')

const port = process.env.PORT || 8000

//APP secrets
const ACCESS_TOKEN = process.env.ACCESS_TOKEN,
    APP_ID = process.env.APP_ID,
    APP_SECRET = process.env.APP_SECRET,
    VERIFY_TOKEN = process.env.VERIFY_TOKEN,
    DATABASE_URL = process.env.DATABASE_URL

// creating app secret proof and time as required by graph api
const appsecret_time = dayjs().unix()
const appsecret_proof = crypto.createHmac('sha256',APP_SECRET).update(ACCESS_TOKEN+ '|' + appsecret_time).digest('hex') 

console.log(appsecret_time + ' ' + appsecret_proof)

const graphapi = "https://graph.facebook.com" 

app.use(bodyParser.json())   //body parser middleware

//handlers
function messageHandler(sender_psid, received_message) {}

function postbackHandler(sender_psid,received_postback) {}

//webhook endpoint event listener 
app.post('/webhook', (req,res) => {
    let body = req.body

    if(body.object === 'page') {
        
        body.entry.forEach(entry => {
            
            let webhook_event = entry.messaging[0]
            let sender_psid = webhook_event.sender.id

            if(webhook_event.message) {

                messageHandler(sender_psid,webhook_event.message)

            } else if(webhook_event.postback) {

                postbackHandler(sender_psid,webhook_event.postback)

            }
        })
    } else {
        res.sendStatus(404);
    }
})

//token verification
app.get('/webhook', (req,res) => {
    
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if(token) {
        if(token == VERIFY_TOKEN) {
            res.status(200).send(challenge)
        } else {
            res.sendStatus(403)
        }
    } 
})




app.listen(port, () => {
    console.log('Hello world!')
})