var path = require('path')
var util = require('util')
var multer  = require('multer')
//var upload = multer({ dest: 'tempFile/' })
//const Logs = require('./write-log.js')
//Logs.writeLog("testing")
require('dotenv').load();

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + file.originalname)
  }
})
var upload = multer({ storage: storage })

var express = require('express');
var session = require('express-session');

var app = express();

app.use(session({
  secret: process.env.SECRET_TOKEN,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  //cookie: { maxAge: 5 * 60 * 1000 },
  resave: true,
  saveUninitialized: true
}));
var bodyParser = require('body-parser');
var urlencoded = bodyParser.urlencoded({extended: false})

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(urlencoded);

console.log("PORT " + process.env.PORT)
var port = process.env.PORT || 3000

var server = require('http').createServer(app);
server.listen(port);
console.log("listen to port " + port)
var router = require('./router');

app.get('/', function (req, res) {
  //console.log('load index page /')
  res.redirect('index')
})

app.get('/index', function (req, res) {
  //console.log('load index page /index')
  if (req.query.n != undefined && req.query.n == 1){
    router.logout(req, res)
  }else {
    res.render('index')
  }
})

app.get('/relogin', function (req, res) {
  //console.log('force to relogin')
  if (req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
  if (req.session.hasOwnProperty("extensionId"))
    req.session.extensionId = 0;

  res.render('index')
})

app.get('/login', function (req, res) {
  //req.session.cookie = { maxAge: 24 * 60 * 60 * 1000 }
  if (!req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
  if (!req.session.hasOwnProperty("extensionId"))
    req.session.extensionId = 0;

  router.loadLogin(req, res)
})

app.get('/logout', function (req, res) {
  router.logout(req, res)
})

app.get('/main', function (req, res) {
  console.log('loadOptionPage')
  if (req.session.extensionId != 0)
    router.loadOptionPage(req, res)
  else{
    res.render('index')
  }
})
app.get('/standard', function (req, res) {
  console.log('loadStandardSMSPage')
  if (req.session.extensionId != 0)
    router.loadStandardSMSPage(req, res)
  else{
    res.render('index')
  }
})

app.get ('/logs', function (req, res) {
  console.log('loadCampaign Log Page')
  if (req.session.extensionId != 0)
    router.loadCampaignHistoryPage(req, res)
  else{
    res.render('index')
  }
})

app.get('/campaigns', function (req, res) {
  console.log('load campaigns')
  if (req.session.extensionId != 0)
    router.loadHVSMSPage(req, res)
  else{
    res.render('index')
  }
})

app.get('/about', function (req, res) {
  if (req.session.extensionId != 0)
    router.loadHelpPage(req, res)
  else{
    res.render('about')
  }
})

app.get('/settings', function (req, res) {
  if (req.session.extensionId != 0)
    router.loadSettingsPage(req, res)
  else{
    res.render('index')
  }
})

app.get ('/analytics', function (req, res) {
  console.log('loadAnalyticsPage')
  if (req.session.extensionId != 0)
    router.loadAnalyticsPage(req, res)
  else{
    res.render('index')
  }
})

app.get ('/share-number', function (req, res) {
  console.log('loadShareNumberPage')
  if (req.session.extensionId != 0)
    router.loadShareNumberPage(req, res)
  else{
    res.render('index')
  }
})

app.get ('/monitor', function (req, res) {
  console.log('loadMonitorPage')
  if (req.session.extensionId != 0)
    router.loadMonitorPage(req, res)
  else{
    res.render('index')
  }
})

app.get("/poll-new-messages", function (req, res) {
  if (req.session.extensionId != 0)
    router.pollNewMessages(req, res)
  else{
    res.render('index')
  }
})

app.get("/poll-analytics-result", function (req, res) {
  if (req.session.extensionId != 0)
    router.pollAnalyticsResult(req, res)
  else{
    res.render('index')
  }
})

app.get("/poll-active-users", function (req, res) {
  if (req.session.extensionId != 0)
    router.pollActiveUsers(req, res)
  else{
    res.render('index')
  }
})

app.post('/set_reputation', function (req, res) {
  console.log('reset_reputation')
  if (req.session.extensionId != 0)
    router.setReputation(req, res)
  else{
    res.render('index')
  }
})

app.post('/get_message_snapshots', function (req, res) {
  console.log('get_message_snapshots')
  if (req.session.extensionId != 0)
    router.getMessageSnapshots(req, res)
  else{
    res.render('index')
  }
})

app.get("/optout-numbers", function (req, res) {
  if (req.session.extensionId != 0)
    router.readOptedOutNumber(req, res)
  else{
    res.render('index')
  }
})

app.get('/read-campaign-summary', function (req, res) {
  console.log('readCampaignSummary')
  if (req.session.extensionId != 0)
    router.readCampaignSummary(req, res)
  else{
    res.render('index')
  }
})

app.get('/read-campaign-details', function (req, res) {
  console.log('readCampaignDetails')
  if (req.session.extensionId != 0)
    router.readCampaignDetails(req, res)
  else{
    res.render('index')
  }
})

app.post('/read-message-store', function (req, res) {
  console.log('readMessageStore')
  if (req.session.extensionId != 0)
    router.readMessageList(req, res)
  else{
    res.render('index')
  }
})

app.post('/create-messaging-analytics', function (req, res) {
  console.log('getMessagingAnalytics')
  if (req.session.extensionId != 0)
    router.getMessagingAnalytics(req, res)
  else{
    res.render('index')
  }
})

app.get('/get-contacts', function (req, res) {
  console.log('readContacts')
  if (req.session.extensionId != 0)
    router.getContacts(req, res)
  else{
    res.render('index')
  }
})

app.get('/read-campaigns', function (req, res) {
  console.log('load readCampaignsLogFromDB')
  if (req.session.extensionId != 0)
    router.readCampaignsLogFromDB(req, res)
  else{
    res.render('index')
  }
})

app.get('/get-standard-sms-result', function (req, res) {
  if (req.session.extensionId != 0)
    router.getStandardSMSResult(req, res)
  else{
    res.render('index')
  }
})

app.get('/get-batch-result', function (req, res) {
  if (req.session.extensionId != 0)
    router.getBatchResult(req, res)
  else{
    res.render('index')
  }
})

app.get('/cancel-scheduled-campaign', function (req, res) {
  if (req.session.extensionId != 0)
    router.cancelScheduledCampaign(req, res)
  else{
    res.render('index')
  }
})

app.get('/download-batch-report', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadBatchReport(req, res)
  else{
    res.render('index')
  }
})

app.get('/download-invalid-number', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadInvalidNumbers(req, res)
  else{
    res.render('index')
  }
})

app.get('/delete-campaign-result', function (req, res) {
  if (req.session.extensionId != 0)
    router.deleteCampaignResult(req, res)
  else{
    res.render('index')
  }
})

app.get('/download-analytics', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadAnalytics(req, res)
  else{
    res.render('index')
  }
})

app.get('/download-hv-message-store', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadHVMessageStore(req, res)
  else{
    res.render('index')
  }
})

app.get('/download-standard-message-report', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadStandardSMSReport(req, res)
  else{
    res.render('index')
  }
})

app.get('/downloads', function(req, res){
  console.log(req.query)
  var file = req.query.filename;
  res.download(file);
});

app.get('/oauth2callback', function(req, res){
  console.log("callback redirected")
  router.login(req, res)
})

app.get('/setdelay', function (req, res) {
  if (req.session.extensionId != 0)
    router.setDelayInterVal(req, res)
  else{
    res.render('index')
  }
})

app.get('/pause', function (req, res) {
  if (req.session.extensionId != 0)
    router.pauseMessageSending(req, res)
  else{
    res.render('index')
  }
})

app.get('/resume', function (req, res) {
  if (req.session.extensionId != 0)
    router.resumeMessageSending(req, res)
  else{
    res.render('index')
  }
})

app.get('/cancel', function (req, res) {
  if (req.session.extensionId != 0)
    router.cancelMessageSending(req, res)
  else{
    res.render('index')
  }
})

app.post('/sendmessage', upload.single('attachment'), function (req, res) {
   console.log("Send a message");
   if (req.session.extensionId != 0)
     router.sendSMSMessage(req, res)
   else{
     res.render('index')
   }
})

app.post('/sendbroadcastmessages', upload.any(), function (req, res, next) {
  console.log("post sendbroadcastmessages")
  router.sendBroadcastMessage(req, res)
})

app.post('/sendhvmessages', upload.any(), function (req, res, next) {
  console.log("post sendhvmessages")
  router.sendHighVolumeMessage(req, res)
})

app.post('/sendsms', function (req, res) {
  console.log("sendsms")
  router.sendSMSMessage(req, res)
})

app.post('/sendfeedback', function (req, res) {
  console.log("sendfeedback")
  router.postFeedbackToGlip(req, res)
})

app.post('/uploadcontact', upload.any(), function (req, res, next) {
  console.log("post uploadcontact")
  router.uploadContacts(req, res)
})

app.post('/delete-contacts', function (req, res) {
  console.log("delete-contacts")
  router.deleteContacts(req, res)
})

app.post('/set-webhook', function (req, res) {
  console.log("set-webhook")
  router.setWebhookAddress(req, res)
})

app.post('/save-template', function (req, res) {
  console.log("save-template")
  router.saveTemplate(req, res)
})

app.post('/delete-template', function (req, res) {
  console.log("delete-template")
  router.deleteTemplate(req, res)
})

app.post('/delete-signature', function (req, res) {
  console.log("delete-signature")
  router.deleteSignature(req, res)
})

app.get('/read-webhook', function (req, res) {
  console.log("read-webhook")
  router.readWebhookAddress(req, res)
})

app.get('/read-templates', function (req, res) {
  console.log("read-templates")
  router.readTemplates(req, res)
})

app.get('/delete-webhook', function (req, res) {
  console.log("delete-webhook")
  router.deleteWebhookAddress(req, res)
})

// Receiving RingCentral webhooks notifications
app.post('/webhookcallback', function(req, res) {
    if(req.headers.hasOwnProperty("validation-token")) {
        res.setHeader('Validation-Token', req.headers['validation-token']);
        res.statusCode = 200;
        res.end();
    }else{
      //console.log(res)
        var body = []
        req.on('data', function(chunk) {
            body.push(chunk);
        }).on('end', function() {
            body = Buffer.concat(body).toString();
            var jsonObj = JSON.parse(body)
            if (jsonObj.event.indexOf("/a2p-sms/batches?") >= 0){
              router.processBatchEventNotication(jsonObj)
            }
            res.statusCode = 200;
            res.end();
        });
    }
})

// Test support Glip team
app.get('/support-team', function(req, res){
  res.render('join-support')
})

app.post('/invite-user', function (req, res) {
  router.sendInviteToSupportTeam(req, res)
})
