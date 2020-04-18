var path = require('path')
var util = require('util')
var multer  = require('multer')
var upload = multer({ dest: 'tempFile/' })

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
  if (req.session.extensionId != 0)
    router.logout(req, res)
  else{
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

app.get('/index', function (req, res) {
  if (req.query.n != undefined && req.query.n == 1){
    router.logout(req, res)
  }else {
    res.render('index')
  }
})

app.get('/logout', function (req, res) {
  router.logout(req, res)
})

app.get('/loadsmspage', function (req, res) {
  if (req.session.extensionId != 0)
    router.loadSendSMSPage(req, res)
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

app.get('/downloadreport', function (req, res) {
  router.downloadSendSMSResult(req, res)
})
app.get('/downloads', function(req, res){
  var file = req.query.filename;
  res.download(file); // Set disposition and send it.
});

app.get('/oauth2callback', function(req, res){
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
   router.sendSMSMessage(req, res)
})

app.post('/sendsms', function (req, res) {
  router.sendSMSMessage(req, res)
})

app.post('/sendfeedback', function (req, res) {
  router.postFeedbackToGlip(req, res)
})
