require('dotenv').config()


const express = require('express'),
    bodyParser = require('body-parser'),
    axios = require('axios').default,
    app = express(),
    crypto = require('crypto'),
    dayjs = require('dayjs'),
    fs = require('fs'),
    menu = require('./templates/menu.json'),
    expenseMenu = require('./templates/expenseMenu.json'),
    port = process.env.PORT || 8000

//APP secrets
const ACCESS_TOKEN = process.env.ACCESS_TOKEN,
    APP_ID = process.env.APP_ID,
    APP_SECRET = process.env.APP_SECRET,
    VERIFY_TOKEN = process.env.VERIFY_TOKEN
 
// acceptable greetings
const acceptGreet = ['Hello','Hi','hello','hi','hey','Hey','getstarted']

//acceptable expenses
const expenses = ['supplies','salaries','legal','insurance','tax','maintenance','advertisement']

//graph api
const graphapi = "https://graph.facebook.com/v12.0"

//state variables
let chatState = [] 
let expenseSelected = [];

//mock db
const dbMock = new Map()


// expense calculator 
function expenseCalculator(sender_psid) {

    const id = sender_psid

    let expCategorized = []

    expCategorized[id] = []

    dbMock.get(id).forEach((expense) => {
        expCategorized[id].push(expense.reduce((acc,res) => acc + res,0))
    })

    let total = expCategorized[id].reduce((acc,res) => acc + res,0)

    return {total, expCategorized}
}

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

        let id = parseInt(sender_psid)

        if(dbMock.has(id)) {

            const report = expenseCalculator(id)
            console.log(report)

            response = { "text": `Your total expense is ${report.total}$.\nYour total categorized expenditure is : 
                'supplies' = ${report.expCategorized[id][0]}$,
                'salaries'= ${report.expCategorized[id][1]}$,
                'legal'= ${report.expCategorized[id][2]}$,
                'insurance'= ${report.expCategorized[id][3]}$,
                'tax'= ${report.expCategorized[id][4]}$,
                'maintenance'= ${report.expCategorized[id][5]}$,
                'advertisement'= ${report.expCategorized[id][6]}$`}

        } else {

            response = {"text": `Your total expense is 0$.`}

        }

        sendAPI(sender_psid,response)

        sendAPI(sender_psid,menu)
    }
}

function quickReplyHandler(sender_psid,received_message) {

    if(expenses.includes(received_message)) {

        chatState[sender_psid] = 1

        expenseSelected[sender_psid] = received_message

        console.log(chatState[sender_psid] + ' ' + expenseSelected[sender_psid])

        let response = {"text" : `Please enter the amount for "${received_message}" category. Amount should only be numeric`}

        sendAPI(sender_psid, response)

        //if amount added respond with success msg and menu
    }

}

function expenseHandler(sender_psid, amount) {

    const id = parseInt(sender_psid)

    if(!dbMock.has(id)) {

        const expense = new Map()

        expense.set("supplies",[])
        expense.set("salaries",[])
        expense.set("legal",[])
        expense.set("insurance",[])
        expense.set("tax",[])
        expense.set("maintenance",[])
        expense.set("advertisement",[])

        dbMock.set(id,expense)
    }

    dbMock.get(id).get(expenseSelected[sender_psid]).push(parseInt(amount))

    let response = {"text": `Your expense has been successfully added to "${expenseSelected[sender_psid]}" category.`}
    
    sendAPI(sender_psid,response)

    sendAPI(sender_psid,menu)

    //reset state after adding expenses
    chatState[sender_psid] = 0
    expenseSelected[sender_psid] = ''
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
// verifying the post req sent by facebook
function verifySignature(req, res, buf) {

    let signature = req.headers['x-hub-signature'];

    if (!signature) {

        throw new Error('Signature not included in the request.')

    } else {

        let elements = signature.split('=');
        
        let signatureHash = elements[1];

        let expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

        if (signatureHash != expectedHash) {
            throw new Error('Couldn\'t validate the request signature.');

        }
    }
}

//body parser middleware
app.use(bodyParser.json({verify: verifySignature}))   

//webhook endpoint event listener 
app.post('/webhook', (req,res) => {

    let body = req.body

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