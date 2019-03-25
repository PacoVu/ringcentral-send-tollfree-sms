const User = require('./usershandler.js')
require('dotenv').load()
var users = []

function getUserIndex(id){
  //console.log("USERS LENGTH:" + users.length)
  for (var i=0; i<users.length; i++){
    var user = users[i]
    if (user != null){
      //console.log("USER ID:" + user.getUserId())
      if (id == user.getUserId()){
        return i
      }
    }
  }
  return -1
}

function getUserIndexByExtensionId(extId){
  //console.log("USERS LENGTH:" + users.length)
  for (var i=0; i<users.length; i++){
    var user = users[i]
    //console.log("EXTENSiON ID:" + user.getExtensionId())
    if (extId == user.getExtensionId()){
      return i
    }
  }
  return -1
}

var router = module.exports = {
  loadLogin: function(req, res){
    if (req.session.userId == 0 || req.session.extensionId == 0) {
      console.log("load login page")
      var id = new Date().getTime()
      console.log(id)
      req.session.userId = id;
      var user = new User(id, req.query.env)
      users.push(user)
      var p = user.getPlatform()
      if (p != null){
        res.render('login', {
          authorize_uri: p.loginUrl({
            brandId: process.env.RINGCENTRAL_BRAND_ID,
            redirectUri: process.env.RC_APP_REDIRECT_URL
          }),
          redirect_uri: process.env.RC_APP_REDIRECT_URL,
          token_json: ''
        });
      }
    }else{
      console.log("Must be a reload page")
      var index = getUserIndex(req.session.userId)
      if (index >= 0)
        users[index].loadSendSMSPage(req, res)
      else{
        this.forceLogin(req, res)
      }
    }
  },
  forceLogin: function(req, res){
    console.log("FORCE LOGIN")
    req.session.destroy();
    res.render('index')
  },
  login: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].login(req, res, function(err, extensionId){
      // result contain extensionId. Use it to check for orphan user and remove it
      if (!err){
        console.log("USERLENGTH: " + users.length)
        for (var i = 0; i < users.length; i++){
          console.log("REMOVING")
          var extId = users[i].getExtensionId()
          var userId = users[i].getUserId()
          if (extId == extensionId && userId != req.session.userId){
            console.log("REMOVE USER: " )
            users[i] = null
            users.splice(i, 1);
            break
          }
        }
      }
    })
  },
  logout: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0){
      return this.forceLogin(req, res)
    }
    var thisObj = this
    users[index].logout(req, res, function(err, result){
      users[index] = null
      console.log("user length before: " + users.length)
      users.splice(index, 1);
      console.log("user length after: " + users.length)
      thisObj.forceLogin(req, res)
    })
  },
  getSendSMSResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getSendSMSResult(req, res)
  },
  sendSMSMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    //users[index].sendSMSMessageAsync(req, res)
    users[index].sendSMSMessageSync(req, res)
  },
  loadAboutPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    res.render('about', {
      userName: users[index].getUserName()
    })
  },
  loadSendSMSPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadSendSMSPage(req, res)
  }
}
