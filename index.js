var path = require('path')
var util = require('util')
var multer  = require('multer')
//var upload = multer({ dest: 'tempFile/' })

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + file.originalname)
  }
})
var upload = multer({ storage: storage })

if('production' !== process.env.LOCAL_ENV )
  require('dotenv').load();

var express = require('express');
var session = require('express-session');

var app = express();
//app.use(session());
app.use(session({ secret: process.env.SECRET_TOKEN, cookie: { maxAge: 24 * 60 * 60 * 1000 }}));
var bodyParser = require('body-parser');
var urlencoded = bodyParser.urlencoded({extended: false})

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(urlencoded);

var port = process.env.PORT || 5000

var server = require('http').createServer(app);
server.listen(port);
console.log("listen to port " + port)
var router = require('./router');

app.get('/', function (req, res) {
  console.log('load option page /')
  /*
  if (req.session.extensionId != undefined){
    console.log("ext id: " + req.session.extensionId)
    router.logout(req, res)
  }else{
    res.redirect('index')
  }
  */
  res.redirect('index')
})

app.get('/index', function (req, res) {
  console.log('load index page /index')
  if (req.query.n != undefined && req.query.n == 1){
    router.logout(req, res)
  }else {
    //router.loadSendHighVolumeSMSPage(req, res)
    //router.loadOptionPage(req, res)
    res.render('index')
  }
})

app.get('/login', function (req, res) {
  req.session.cookie = { maxAge: 24 * 60 * 60 * 1000 }
  if (!req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
    if (!req.session.hasOwnProperty("extensionId"))
      req.session.extensionId = 0;

  router.loadLogin(req, res)
})

app.get('/logout', function (req, res) {
  router.logout(req, res)
})

app.get('/options', function (req, res) {
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

app.get ('/campaign', function (req, res) {
  console.log('loadCampaignPage')
  if (req.session.extensionId != 0)
    router.loadCampaignHistoryPage(req, res)
  else{
    res.render('index')
  }
})

app.get('/message-store', function (req, res) {
  console.log('loadMessageStorePage')
  if (req.session.extensionId != 0)
    router.loadMessageStorePage(req, res)
  else{
    res.render('index')
  }
})

app.get('/read_campaign', function (req, res) {
  console.log('readCampaign')
  if (req.session.extensionId != 0)
    router.getBatchReport(req, res)
  else{
    res.render('index')
  }
})

app.post('/read_message_store', function (req, res) {
  console.log('readMessageStore')
  if (req.session.extensionId != 0)
    router.readMessageList(req, res)
  else{
    res.render('index')
  }
})

app.get ('/highvolume-template', function (req, res) {
  console.log('load highvolume-template')
  if (req.session.extensionId != 0)
    router.loadHVTemplatePage(req, res)
  else{
    res.render('index')
  }
})

app.get('/highvolume-manual', function (req, res) {
  console.log('load highvolume-manual')
  if (req.session.extensionId != 0)
    router.loadHVManualPage(req, res)
  else{
    res.render('index')
  }
})

app.get('/about', function (req, res) {
  res.render('about')
})

app.get('/getresult', function (req, res) {
  if (req.session.extensionId != 0)
    router.getSendSMSResult(req, res)
  else{
    res.render('index')
  }
})

app.get('/getbatchreport', function (req, res) {
  if (req.session.extensionId != 0)
    router.getBatchReport(req, res)
  else{
    res.render('index')
  }
})

app.get('/getbatchresult', function (req, res) {
  if (req.session.extensionId != 0)
    router.getBatchResult(req, res)
  else{
    res.render('index')
  }
})

app.get('/downloadbatchreport', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadBatchReport(req, res)
  else{
    res.render('index')
  }
})

app.get('/downloadmessagestore', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadMessageStore(req, res)
  else{
    res.render('index')
  }
})

app.get('/downloadreport', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadSendSMSResult(req, res)
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
  router.sendHighVolumeSMSMessage(req, res)
})

app.post('/sendtailoredmessages', upload.any(), function (req, res, next) {
  console.log("post sendtailoredmessages")
  router.sendHighVolumeSMSMessageAdvance(req, res)
})

app.post('/sendindividualmessage', upload.any(), function (req, res, next) {
  console.log("post sendindividualmessage")
  router.sendIndividualMessage(req, res)
})


app.post('/sendsms', function (req, res) {
  console.log("sendsms")
  router.sendSMSMessage(req, res)
})

app.post('/sendfeedback', function (req, res) {
  console.log("sendfeedback")
  router.postFeedbackToGlip(req, res)
})
