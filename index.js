var path = require('path')
var util = require('util')

var express = require('express');

var app = express();

var bodyParser = require('body-parser');
var urlencoded = bodyParser.urlencoded({extended: false})

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(urlencoded);

var port = process.env.PORT || 8080

var server = require('http').createServer(app);
server.listen(port);
console.log("listen to port " + port)

app.get('/', function (req, res) {
  console.log('load index page /')
  res.redirect('index')
})

app.get('/index', function (req, res) {
  console.log('load index page /index')
  if (req.query.n != undefined && req.query.n == 1){
    router.logout(req, res)
  }else {
    res.render('index')
  }
})
