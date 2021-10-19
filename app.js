require('dotenv').config()


const express = require('express'),
    bodyParser = require('body-parser'),
    axios = require('axios').default,
    app = express(),
    crypto = require('crypto')
    dayjs = require('dayjs')
    fs = require('fs')
    menu = require('./templates/menu.json')
    expenseMenu = require('./templates/expenseMenu.json')

const port = process.env.PORT || 8000

//APP secrets
const ACCESS_TOKEN = process.env.ACCESS_TOKEN,
    APP_ID = process.env.APP_ID,
    APP_SECRET = process.env.APP_SECRET,
    VERIFY_TOKEN = process.env.VERIFY_TOKEN,
    DATABASE_URL = process.env.DATABASE_URL

//creating app secret proof and time as required by graph api
const appsecret_time = dayjs().unix()
const appsecret_proof = crypto.createHmac('sha256',APP_SECRET).update(ACCESS_TOKEN+ '|' + appsecret_time).digest('hex') 

console.log(appsecret_proof + ' ' + appsecret_time)
// acceptable greetings
const acceptGreet = ['Hello','Hi','hello','hi','hey','Hey','getstarted']

const expenses = ['supplies','salaries','legal','insurance','tax','maintenance','advertisement']

let graphapi = "https://graph.facebook.com/v12.0"

app.use(bodyParser.json())   //body parser middleware

//greeting 

function setGetStarted() {

    let payload = JSON.stringify({"get_started" : {"payload":"getstarted"}})

    let conf = {
        method:'post',
        url: `${graphapi}/me/messenger_profile?access_token=${ACCESS_TOKEN}&appsecret_proof=${appsecret_proof}&appsecret_time=${appsecret_time}`,
        headers: { 
            'Content-Type': 'application/json'
          },
        data : payload
    }

    axios(conf)
        .then((res) => {
            
        },(error) => {
            console.log(error)
        })

}



//handlers
function messageHandler(sender_psid, received_message) {

    let response;

    if(!(acceptGreet.includes(received_message))) {

        response = {
            "text" : `Sorry, I am still learning and cannot process your request for "${received_message}". Please choose one of the options to proceed.`
        }
        

    } else {

        response = { "text": `Howdy! I will help you manage your office expenses and generate useful reports for you! Type "Hey" anytime to start over` }
    
    }

    sendAPI(sender_psid, response)

    sendAPI(sender_psid, menu)
}

function postbackHandler(sender_psid,received_postback) {

    let response;

    let payload = received_postback;

    if(payload === 'expense' ) {
        
        response = expenseMenu
        

    } else if(payload === 'report') {
        
        response = {"text": `Your total expense is {{expense}}. You spent the most on {{category}}`}
        
    }

    if(payload === 'report') {
        
        const response2 = {"text": `To get categorize list of expenses type "expense by category" or type "Hey" to start over.`}
        
        sendAPI(sender_psid,response2)
   
    } 
        
    sendAPI(sender_psid,response)

}

function quickReplyHandler(sender_psid,received_message) {

    if(expenses.includes(received_message)) {
        
        let response = {"text" : `Please enter the amount for "${received_message}" category`}

        sendAPI(sender_psid, response)
    }

}

// send api to reply to messages
function sendAPI(sender_psid, response) {

    let req_body = {
        "recipient" : {
            "id": sender_psid
        },
        "message": response
    }

    let payload = JSON.stringify(req_body)

    let config = {
        method:'post',
        url: `${graphapi}/me/messages?access_token=${ACCESS_TOKEN}&appsecret_proof=${appsecret_proof}&appsecret_time=${appsecret_time}`,
        headers: {
            'Content-Type': 'application/json'
        },
        data : payload
    }
   
    axios(config)
        .then((res) => {
            
        },(error) => {
            console.log(error)
        })
    
}



//webhook endpoint event listener 
app.post('/webhook', (req,res) => {

    let body = req.body
    console.log(body.entry[0].messaging[0])
    if(body.object === 'page') {
        
        body.entry.forEach(entry => {
            
            let webhook_event = entry.messaging[0]

            let sender_psid = webhook_event.sender.id

            if(webhook_event.message) {

                if(webhook_event.message.quick_reply) {

                    quickReplyHandler(sender_psid, webhook_event.message.quick_reply.payload)

                } else {

                    messageHandler(sender_psid,webhook_event.message.text)
                }
            
            } else if(webhook_event.postback) {

                if(webhook_event.postback.payload === 'getstarted') {

                    messageHandler(sender_psid,webhook_event.postback.payload)

                } else {

                    postbackHandler(sender_psid,webhook_event.postback.payload)
                }
            } 
        })
        // 200 response is necessary
        res.sendStatus(200)
        
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
    setGetStarted()
    console.log(`Chatbot is running on ${port}`)

})