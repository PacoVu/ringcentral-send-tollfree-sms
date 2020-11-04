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
app.use(session({ secret: 'this-is-a-secret-token', cookie: { maxAge: 24 * 60 * 60 * 1000 }}));
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
  //res.render('index')
  if (req.session.extensionId != 0)
    router.logout(req, res)
  else{
    res.render('index')
  }
})
app.get('/login', function (req, res) {
  console.log('login to /')
  req.session.cookie = { maxAge: 24 * 60 * 60 * 1000 }
  if (!req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
    if (!req.session.hasOwnProperty("extensionId"))
      req.session.extensionId = 0;
  console.log("SESSION:" + JSON.stringify(req.session))
  router.loadLogin(req, res)
})

app.get('/index', function (req, res) {
  console.log('load option page /')
  if (req.query.n != undefined && req.query.n == 1){
    console.log('logout from here?')
    router.logout(req, res)
  }else {
    //res.render('index')
    router.loadSendHighVolumeSMSPage(req, res)
  }
})

app.get('/logout', function (req, res) {
  console.log('logout why here?')
  router.logout(req, res)
})

app.get('/loadoptionpage', function (req, res) {
  console.log('loadOptionPage')
  if (req.session.extensionId != 0)
    router.loadOptionPage(req, res)
    //router.loadSendHighVolumeSMSPage(req, res)
  else{
    res.render('index')
  }
})
app.get('/loadsmspage', function (req, res) {
  console.log('loadSendSMSPage')
  if (req.session.extensionId != 0)
    router.loadSendSMSPage(req, res)
  else{
    res.render('index')
  }
})

app.get('/loada2psmspage', function (req, res) {
  console.log('loadSendHighVolumeSMSPage')
  if (req.session.extensionId != 0)
    router.loadSendHighVolumeSMSPage(req, res)
  else{
    res.render('index')
  }
})

app.get('/about', function (req, res) {
  router.loadAboutPage(req, res)
})

app.get('/getresult', function (req, res) {
  router.getSendSMSResult(req, res)
})

app.get('/getbatchreport', function (req, res) {
  router.getBatchReport(req, res)
})

app.get('/getbatchresult', function (req, res) {
  router.getBatchResult(req, res)
})

app.get('/downloadreport', function (req, res) {
  router.downloadSendSMSResult(req, res)
})
app.get('/downloads', function(req, res){
  console.log(req.query)
  var file = req.query.filename;
  res.download(file); // Set disposition and send it.
});

app.get('/oauth2callback', function(req, res){
  console.log("callback redirected")
  router.login(req, res)
})

app.get('/setdelay', function (req, res) {
  router.setDelayInterVal(req, res)
})

app.get('/pause', function (req, res) {
  router.pauseMessageSending(req, res)
})

app.get('/resume', function (req, res) {
  router.resumeMessageSending(req, res)
})

app.get('/cancel', function (req, res) {
  router.cancelMessageSending(req, res)
})

app.post('/sendmessage', upload.single('attachment'), function (req, res) {
   console.log("Send a message");
   router.sendSMSMessage(req, res)
})
/*
app.post('/sendhighvolumemessage', upload.single('attachment'), function (req, res) {
  console.log("post sendhighvolumemessage")
  router.sendHighVolumeSMSMessage(req, res)
})
*/
app.post('/sendhighvolumemessage', upload.any(), function (req, res, next) {
  console.log("post sendhighvolumemessage")
  router.sendHighVolumeSMSMessage(req, res)
})

app.post('/sendsms', function (req, res) {
  console.log("sendsms")
  router.sendSMSMessage(req, res)
})

app.post('/sendfeedback', function (req, res) {
  console.log("sendfeedback")
  router.postFeedbackToGlip(req, res)
})
