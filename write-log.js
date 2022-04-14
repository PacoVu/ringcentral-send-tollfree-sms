var fs = require('fs')
require('dotenv').load()

const LOG_MODE = "CONSOLE"
var fileName = ""
var dir = "logs/"
if(!fs.existsSync(dir)){
  fs.mkdirSync(dir)
}

function writeLog(extensionId, textLine){
  if (LOG_MODE == "FILE"){
    var file_name = `user_${extensionId}.txt`
    try{
      fs.appendFileSync(`./logs/${file_name}`, `${textLine}\r\n`)
    }catch (e){
      console.log("cannot write log file")
    }
  }else if (LOG_MODE == "CONSOLE"){
    console.log(textLine)
  }
}

exports.writeLog = writeLog;

/*
var LogUtility = module.exports = {
  writeLog: function(){
    return activeUsers
  },
  removeActiveUser: function(extensionId){
    console.log("removeActiveUser " + extensionId)
    var index = activeUsers.findIndex(o => o.extensionId.toString() === extensionId)
    if (index >= 0){
      console.log("activeUsers length before: " + activeUsers.length)
      activeUsers[index] = null
      activeUsers.splice(index, 1)
      console.log("activeUsers length after: " + activeUsers.length)
    }
  }
}
*/
