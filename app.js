const { send } = require('process')

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
    VERIFY_TOKEN = process.env.VERIFY_TOKEN
 
// acceptable greetings
const acceptGreet = ['Hello','Hi','hello','hi','hey','Hey','getstarted']

const expenses = ['supplies','salaries','legal','insurance','tax','maintenance','advertisement']

//state variables
let chatState = [] 
let expenseSelected;
const dbMock = new Map()
const expense = new Map()
expense.set("supplies",[])
expense.set("salaries",[])
expense.set("legal",[])
expense.set("insurance",[])
expense.set("tax",[])
expense.set("maintenance",[])
expense.set("advertisement",[])
//

let graphapi = "https://graph.facebook.com/v12.0"

app.use(bodyParser.json())   //body parser middleware

//greeting 

function setGetStarted() {

    let payload = JSON.stringify({"get_started" : {"payload":"getstarted"}})

    let conf = {
        method:'post',
        url: `${graphapi}/me/messenger_profile?access_token=${ACCESS_TOKEN}`,
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

    if(!(acceptGreet.includes(received_message)) && !chatState[sender_psid]) {

        response = {
            "text" : `Sorry, I am still learning and cannot process your request for "${received_message}". Please choose one of the options to proceed.`
        }
        
        sendAPI(sender_psid, response)

        sendAPI(sender_psid, menu)


    } else if(acceptGreet.includes(received_message) && !chatState[sender_psid]){

        response = { "text": `Howdy! I will help you manage your office expenses and generate useful reports for you! Type "Hey" anytime to start over` }
    
        sendAPI(sender_psid, response)    

        sendAPI(sender_psid, menu)

    } else {

        response = {'text': `Please enter the amount for the previous expense selected`}

        sendAPI(sender_psid, response)

    }
}

function postbackHandler(sender_psid,received_postback) {

    let response;

    let payload = received_postback;

    if(payload === 'expense' ) {
        
        response = expenseMenu
        
        sendAPI(sender_psid,response)

    } else if(payload === 'report') {
        //calculate expense
        response = {"text": `Your total expense is {{expense}}.`}
        
        sendAPI(sender_psid,response)

        sendAPI(sender_psid,menu)
    }
        
    

}

function quickReplyHandler(sender_psid,received_message) {

    if(expenses.includes(received_message)) {

        chatState[sender_psid] = 1

        expenseSelected = received_message

        console.log(chatState[sender_psid] + ' ' + expenseSelected)

        let response = {"text" : `Please enter the amount for "${received_message}" category. Amount should only be numeric`}

        sendAPI(sender_psid, response)

        //if amount added respond with success msg and menu
    }

}

function expenseHandler(sender_psid, amount) {

    const id = parseInt(sender_psid)

    if(!dbMock.has(id)) {

        dbMock.set(id,expense)

    }

    dbMock.get(id).get(expenseSelected).push(parseInt(amount))

    let response = {"text": `Your expense has been successfully added to "${expenseSelected}" category.`}
    
    sendAPI(sender_psid,response)

    sendAPI(sender_psid,menu)

    //reset state after adding expenses
    chatState[sender_psid] = 0
    expenseSelected = ''
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
        url: `${graphapi}/me/messages?access_token=${ACCESS_TOKEN}`,
        headers: {
            'Content-Type': 'application/json'
        },
        data : payload
    }
   
    axios(config)
        .then((res) => {
            console.log(res.body)
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

                } else if (chatState[sender_psid] && !isNaN(webhook_event.message.text)) {
                    
                    expenseHandler(sender_psid, webhook_event.message.text)

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