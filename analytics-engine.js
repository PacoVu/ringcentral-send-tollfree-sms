//const pgdb = require('./db')
const keyword_extractor = require("keyword-extractor");

function Analytics(){
  this.failureDataAnalytics = {}
  this.analyticsData = undefined
}

var engine = Analytics.prototype = {
    resetAnalyticsData: function(){
      this.failureDataAnalytics = {
        contents: [], // classified by similar content
        optoutCount: 0, // SMS-CAR-413 
        optoutNumbers: [],
        invalidNumberCount: 0, // SMS-UP-410, SMS-CAR-411, SMS-CAR-412
        invalidNumbers: [],
        invalidErrorCodes: [],
        blacklistedCount: 0, //SMS-UP-431 	 Number blacklisted due to spam.
        blacklistedServiceNumbers: [],
        blacklistedTargetedNumbers: [],
        otherErrorCount: 0, //
        otherErrorNumbers:[],
        otherErrorCodes:[]
      }

      this.analyticsData = {
        task: "Initiated",
        outboundCount: 0,
        inboundCount: 0,
        deliveredCount: 0,
        sendingFailedCount: 0,
        sendingFailedNumbers: [],
        deliveryFailedCount: 0,
        /*
        deliveryFailures: [],
        sendingFailures: [],
        outboundFailureTypes: {
          content: {
            count: 0,
            numbers: [],
            messages: []
          },
          invalidRecipientNumbers: [],
          blockedSenderNumbers: [],
          optoutNumbers: [],
          others: {
            count: 0,
            numbers:[],
            messages: []
          }
        },
        */
        sentMsgCost: 0.0,
        receivedMsgCost: 0.0,
        months: [],
        phoneNumbers: []
      }
    },
    analyzeMessage: function(message){
      var localDate = message.creationTime.substring(0, 7)
      var found = false
      for (var i=0; i<this.analyticsData.months.length; i++){
        var month = this.analyticsData.months[i]
        if (month.month == localDate){
          if (message.direction == "Outbound"){
            this.analyticsData.months[i].outboundCount++
            switch (message.messageStatus) {
              case "Delivered":
              case "Sent":
                this.analyticsData.months[i].deliveredCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                this.analyticsData.months[i].deliveredMsgCost += cost
                break
              case "DeliveryFailed":
                this.analyticsData.months[i].deliveryFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                this.analyticsData.months[i].failedMsgCost += cost
                break
              case "SendingFailed":
                this.analyticsData.months[i].sendingFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                this.analyticsData.months[i].failedMsgCost += cost
                break;
              default:
                break
            }
          }else{ // received messages
            this.analyticsData.months[i].inboundCount++
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            this.analyticsData.months[i].receivedMsgCost += cost
          }
          found = true
          break
        }
      }
      if (!found){
        var item = {
          month: localDate,
          outboundCount: 0,
          inboundCount: 0,
          deliveredCount: 0,
          sendingFailedCount: 0,
          deliveryFailedCount: 0,
          deliveredMsgCost: 0.0,
          failedMsgCost: 0.0,
          receivedMsgCost: 0.0,
        }
        if (message.direction == "Outbound"){
          item.outboundCount++
          switch (message.messageStatus) {
            case "Delivered":
            case "Sent":
              item.deliveredCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              item.deliveredMsgCost += cost
              break
            case "DeliveryFailed":
              item.deliveryFailedCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              item.failedMsgCost += cost
              break
            case "SendingFailed":
              item.sendingFailedCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              item.failedMsgCost += cost
              break;
            default:
              break
          }
        }else{ // received messages
          item.inboundCount++
          var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
          item.receivedMsgCost += cost
        }
        this.analyticsData.months.push(item)
        //console.log(this.analyticsData.months)
      }
      // by phoneNumbers
      found = false
      var fromNumber = (message.direction == "Outbound") ? message.from : message.to[0]
      for (var i=0; i<this.analyticsData.phoneNumbers.length; i++){
        var number = this.analyticsData.phoneNumbers[i]
        if (number.number == fromNumber){
          if (message.direction == "Outbound"){
            this.analyticsData.phoneNumbers[i].outboundCount++
            switch (message.messageStatus) {
              case "Delivered":
              case "Sent":
                this.analyticsData.phoneNumbers[i].deliveredCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                this.analyticsData.phoneNumbers[i].deliveredMsgCost += cost
                break
              case "DeliveryFailed":
                this.analyticsData.phoneNumbers[i].deliveryFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                this.analyticsData.phoneNumbers[i].failedMsgCost += cost
                break
              case "SendingFailed":
                this.analyticsData.phoneNumbers[i].sendingFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                this.analyticsData.phoneNumbers[i].failedMsgCost += cost
                break;
              default:
                break
            }
          }else{ // received messages
            this.analyticsData.phoneNumbers[i].inboundCount++
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            this.analyticsData.phoneNumbers[i].receivedMsgCost += cost
          }
          found = true
          break
        }
      }
      if (!found){
        var item = {
          number: fromNumber,
          outboundCount: 0,
          inboundCount: 0,
          deliveredCount: 0,
          sendingFailedCount: 0,
          deliveryFailedCount: 0,
          deliveredMsgCost: 0.0,
          failedMsgCost: 0.0,
          receivedMsgCost: 0.0,
        }
        if (message.direction == "Outbound"){
          item.outboundCount++
          switch (message.messageStatus) {
            case "Delivered":
            case "Sent":
              item.deliveredCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              item.deliveredMsgCost += cost
              break
            case "DeliveryFailed":
              item.deliveryFailedCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              item.failedMsgCost += cost
              break
            case "SendingFailed":
              item.sendingFailedCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              item.failedMsgCost += cost
              break;
            default:
              break
          }
        }else{ // received messages
          item.inboundCount++
          var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
          item.receivedMsgCost += cost
        }
        this.analyticsData.phoneNumbers.push(item)
        //console.log(this.analyticsData.phoneNumbers)
      }
      // breakout ends

      if (message.direction == "Outbound"){
        this.analyticsData.outboundCount++
        switch (message.messageStatus) {
          case "Delivered":
            this.analyticsData.deliveredCount++
            this.extractKeywords(message)
            break
          case "Sent":
            this.analyticsData.deliveredCount++
            this.extractKeywords(message)
            break
          case "DeliveryFailed":
            this.analyticsData.deliveryFailedCount++
            var code = (message.errorCode != undefined) ? message.errorCode : "Others"
            var toNumber = message.to[0]
            if (code == "SMS-UP-410" || code == "SMS-CAR-411" || code == "SMS-CAR-412"){
              this.failureDataAnalytics.invalidNumberCount++
              if (this.failureDataAnalytics.invalidNumbers.findIndex(n => n === toNumber) < 0)
                this.failureDataAnalytics.invalidNumbers.push(toNumber)
              if (this.failureDataAnalytics.invalidErrorCodes.findIndex(c => c === code) < 0)
                this.failureDataAnalytics.invalidErrorCodes.push(code)
            }else if (code == "SMS-CAR-413"){  // opted out
              this.failureDataAnalytics.optoutCount++
              var sender = this.failureDataAnalytics.optoutNumbers.find(n => n.senderNumber === message.from)
              if (sender){
                if (sender.recipientNumbers.findIndex(n => n === toNumber) < 0)
                  sender.recipientNumbers.push(toNumber)
              }else{
                var item = {
                  senderNumber: message.from,
                  recipientNumbers: [toNumber]
                }
                this.failureDataAnalytics.optoutNumbers.push(item)
              }
            }else if (code == "SMS-UP-431"){ // Number blacklisted due to spam.
              this.failureDataAnalytics.blacklistedCount++
              if (this.failureDataAnalytics.blacklistedTargetedNumbers.findIndex(n => n === toNumber) < 0)
                this.failureDataAnalytics.blacklistedTargetedNumbers.push(toNumber)
              if (this.failureDataAnalytics.blacklistedServiceNumbers.findIndex(n => n === message.from) < 0)
                this.failureDataAnalytics.blacklistedServiceNumbers.push(message.from)
            }else if (code == "SMS-UP-430" || code == "SMS-CAR-430" || code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){
              // content problem
              this.extractKeywords(message)
            }else{ // other errors
              this.failureDataAnalytics.otherErrorCount++
              if (this.failureDataAnalytics.otherErrorNumbers.findIndex(n => n === toNumber) < 0)
                this.failureDataAnalytics.otherErrorNumbers.push(toNumber)
              if (this.failureDataAnalytics.otherErrorCodes.findIndex(c => c === code) < 0)
                this.failureDataAnalytics.otherErrorCodes.push(code)
            }
            break
          case "SendingFailed":
            this.analyticsData.sendingFailedCount++
            var toNumber = message.to[0]
            if (this.analyticsData.sendingFailedNumbers.findIndex(n => n === toNumber) < 0)
              this.analyticsData.sendingFailedNumbers.push(toNumber)
            break;
          default:
            break
        }
        var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
        this.analyticsData.sentMsgCost += cost
      }else{ // received messages
        this.analyticsData.inboundCount++
        var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
        this.analyticsData.receivedMsgCost += cost
      }
    },
    extractKeywords: function(message){
      var keywords = keyword_extractor.extract(message.text, {
          language:"english",
          remove_digits: true,
          return_changed_case: false,
          remove_duplicates: true
      });
      var code = (message.errorCode != undefined) ? message.errorCode : "Others"
      var matchedCount = 0
      for (var item of this.failureDataAnalytics.contents){
        for (var kw of keywords){
          if (item.keywords.findIndex(o => o == kw) >= 0)
            matchedCount++
        }
        if ((matchedCount > 0) && (matchedCount >= (item.keywords.length-2))){
          var toNumber = message.to[0]
          if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
            item.acceptedMsgCount++
            if (item.acceptedMsgNumbers.findIndex(n => n === toNumber) < 0)
              item.acceptedMsgNumbers.push(toNumber)
          }else{
            if (code == "SMS-UP-430" || code == "SMS-CAR-430"){ // item content
              item.spamMsgCount++
              if (item.spamMsgNumbers.findIndex(n => n === toNumber) < 0)
                item.spamMsgNumbers.push(toNumber)
              item.ignore = false
            }else if (code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // content problem
              item.rejectedMsgCount++
              if (item.rejectedMsgNumbers.findIndex(n => n === toNumber) < 0)
                item.rejectedMsgNumbers.push(toNumber)
              if (item.rejectedMsgErrorCodes.findIndex(c => c === code) < 0)
                item.rejectedMsgErrorCodes.push(code)
              item.ignore = false
            }
          }
          //console.log(this.failureDataAnalytics.contents)
          return
        }
        matchedCount = 0
      }
      if (keywords.length > 0){
        var item = {
            ignore: false,
            message: message.text,
            keywords: keywords,
            acceptedMsgCount: 0,
            acceptedMsgNumbers: [],
            spamMsgCount: 0,
            spamMsgNumbers: [],
            rejectedMsgCount: 0, // SMS-CAR-431, SMS-CAR-432, SMS-CAR-433: rejected message issue
            rejectedMsgNumbers: [],
            rejectedMsgErrorCodes: []
          }

        var toNumber = message.to[0]
        if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
          item.acceptedMsgCount++
          item.acceptedMsgNumbers.push(toNumber)
          item.ignore = true
        }else{
          if (code == "SMS-UP-430" || code == "SMS-CAR-430"){ // spam message
            item.spamMsgCount++
            item.spamMsgNumbers.push(toNumber)
          }else if (code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // rejected problem
            item.rejectedMsgCount++
            item.rejectedMsgNumbers.push(toNumber)
            item.rejectedMsgErrorCodes.push(code)
          }
        }
        this.failureDataAnalytics.contents.push(item)
        //console.log(this.failureDataAnalytics.contents)
      }
    }
};

module.exports = Analytics;

function detectPhoneNumber(message){
  var wordArr = message.split(" ")
  var contactNumber = ""
  for (var w of wordArr){
    var number = w.replace(/[+()\-\s]/g, '')
    if (!isNaN(number)){
      if (number.length >= 10 && number.length <= 11){
        contactNumber = w.trim()
        console.log(w)
        break
      }
    }
  }
  return contactNumber
}

const spamContentCodes = ["SMS-UP-430","SMS-CAR-430","SMS-CAR-431","SMS-CAR-432","SMS-CAR-433"]
const invalidNumberCodes = ["SMS-UP-420","SMS-CAR-411","SMS-CAR-412","SMS-UP-410"]
const optoutNumberCodes = ["SMS-CAR-413"]
const blockedNumberCodes = ["SMS-UP-431"]
function failureAnalysis(message){
  var code = (message.errorCode != undefined) ? message.errorCode : "Others"
  var toNumber = message.to[0]
  if (spamContentCodes.findIndex(c => c === code) >= 0){
    this.analyticsData.outboundFailureTypes.content.count++
    if (this.analyticsData.outboundFailureTypes.content.numbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.content.numbers.push(toNumber)
    var url = detectShortenUrl(message.text)
    if (url != ""){
      console.log("URL: " + url)
      if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(link => link === url) < 0)
        this.analyticsData.outboundFailureTypes.content.messages.push(url)
    }else{
      var contactNumber = detectPhoneNumber(message.text)
      if (contactNumber != ""){
        if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(number => number === contactNumber) < 0)
          this.analyticsData.outboundFailureTypes.content.messages.push(contactNumber)
      }else
        this.analyticsData.outboundFailureTypes.content.messages.push(message.text)
    }
  }else if (invalidNumberCodes.findIndex(c => c === code) >= 0){
    // recipient number problem
    if (this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.push(toNumber)
  }else if (optoutNumberCodes[0] == code){
    // opted out
    if (this.analyticsData.outboundFailureTypes.optoutNumbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.optoutNumbers.push(toNumber)
  }else if (blockedNumberCodes[0] == code){
    if (this.analyticsData.outboundFailureTypes.blockedSenderNumbers.findIndex(number => number === message.from) < 0)
      this.analyticsData.outboundFailureTypes.blockedSenderNumbers.push(message.from)
  }else{
    this.analyticsData.outboundFailureTypes.others.count++
    if (this.analyticsData.outboundFailureTypes.others.numbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.others.numbers.push(toNumber)
    this.analyticsData.outboundFailureTypes.others.messages.push(message.text)
  }
}

function detectUrl(message){
  var unsafeLink = ""
  var tempMsg = message.toLowerCase()
  var shortenLinks = [
    "https://",
    "http://"
  ]

  for (var link of shortenLinks){
    var index = tempMsg.indexOf(link)
    if (index >= 0){
      var temp = tempMsg.substring(index, tempMsg.length-1)
      var endIndex = temp.indexOf(" ")
      endIndex = (endIndex > 0) ? endIndex : temp.length+1
      unsafeLink = msg.substr(index, endIndex)
      console.log(message)
      break
    }
  }
  return unsafeLink
}

function detectShortenUrl(message){
  var unsafeLink = ""
  var tempMsg = message.toLowerCase()
  var shortenLinks = [
    "https://bit.ly/",
    "https://ow.ly",
    "https://goo.gl/",
    "https://tinyurl.com/",
    "https://tiny.cc/",
    "https://bc.vc/",
    "https://budurl.com/",
    "https://clicky.me/",
    "https://is.gd/",
    "https://lc.chat/",
    "https://soo.gd/",
    "https://s2r.co/",
    "http://bit.ly/",
    "http://ow.ly",
    "http://goo.gl/",
    "http://tinyurl.com/",
    "http://tiny.cc/",
    "http://bc.vc/",
    "http://budurl.com/",
    "http://clicky.me/",
    "http://is.gd/",
    "http://lc.chat/",
    "http://soo.gd/",
    "http://s2r.co/",
    "https://",
    "http://"
  ]

  for (var link of shortenLinks){
    var index = tempMsg.indexOf(link)
    if (index >= 0){
      var temp = tempMsg.substring(index, tempMsg.length-1)
      var endIndex = temp.indexOf(" ")
      endIndex = (endIndex > 0) ? endIndex : temp.length+1
      unsafeLink = message.substr(index, endIndex)
      break
    }
  }
  return unsafeLink
}

function detectSegment(message){
  var segmented = (message.length > 160) ? 1 : 0
  return segmented
}

function sortRoundTheClock(a,b) {
  return a.hour - b.hour;
}

function sortSegmentCount(a,b) {
  return a.count - b.count;
}

function sortbByNumber(a,b) {
  return a.number - b.number;
}

/*
// by weekDays
found = false
// "creationTime":"2021-05-24T13:49:41.441964Z",
var createdDate = new Date(message.creationTime)
let dateOptions = { weekday: 'short' }
var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
//  createdDateStr += " " + createdDate.toLocaleDateString("en-US")
var wd = createdDateStr.substring(0, 3)
for (var i=0; i<this.analyticsData.weekDays.length; i++){
  var week = this.analyticsData.weekDays[i]
  if (week.wd == wd){
    if (message.direction == "Outbound"){
      this.analyticsData.weekDays[i].outboundCount++
      switch (message.messageStatus) {
        case "Delivered":
        case "Sent":
          this.analyticsData.weekDays[i].deliveredCount++
          break
        case "DeliveryFailed":
          this.analyticsData.weekDays[i].deliveryFailedCount++
          break
        case "SendingFailed":
          this.analyticsData.weekDays[i].sendingFailedCount++
          break;
        default:
          break
      }
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.weekDays[i].sentMsgCost += cost
    }else{ // received messages
      this.analyticsData.weekDays[i].inboundCount++
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.weekDays[i].receivedMsgCost += cost
    }
    found = true
    break
  }
}
if (!found){
  var item = {
    wd: wd,
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0,
  }
  if (message.direction == "Outbound"){
    item.outboundCount++
    switch (message.messageStatus) {
      case "Delivered":
      case "Sent":
        item.deliveredCount++
        break
      case "DeliveryFailed":
        item.deliveryFailedCount++
        break
      case "SendingFailed":
        item.sendingFailedCount++
        break;
      default:
        break
    }
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.sentMsgCost += cost
  }else{ // received messages
    item.inboundCount++
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.receivedMsgCost += cost
  }
  this.analyticsData.weekDays.push(item)
  //console.log(this.analyticsData.weekDays)
}
// by roundTheClock
found = false
// "creationTime":"2021-05-24T13:49:41.441964Z",
var hr = message.creationTime.substring(11, 13)
var hour = parseInt(hr)
for (var i=0; i<this.analyticsData.roundTheClock.length; i++){
  var timeSlide = this.analyticsData.roundTheClock[i]
  if (timeSlide.hour == hour){
    if (message.direction == "Outbound"){
      this.analyticsData.roundTheClock[i].outboundCount++
      switch (message.messageStatus) {
        case "Delivered":
        case "Sent":
          this.analyticsData.roundTheClock[i].deliveredCount++
          break
        case "DeliveryFailed":
          this.analyticsData.roundTheClock[i].deliveryFailedCount++
          break
        case "SendingFailed":
          this.analyticsData.roundTheClock[i].sendingFailedCount++
          break;
        default:
          break
      }
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.roundTheClock[i].sentMsgCost += cost
    }else{ // received messages
      this.analyticsData.roundTheClock[i].inboundCount++
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.roundTheClock[i].receivedMsgCost += cost
    }
    found = true
    break
  }
}
if (!found){
  var item = {
    hour: hour,
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0,
  }
  if (message.direction == "Outbound"){
    item.outboundCount++
    switch (message.messageStatus) {
      case "Delivered":
      case "Sent":
        item.deliveredCount++
        break
      case "DeliveryFailed":
        item.deliveryFailedCount++
        break
      case "SendingFailed":
        item.sendingFailedCount++
        break;
      default:
        break
    }
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.sentMsgCost += cost
  }else{ // received messages
    item.inboundCount++
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.receivedMsgCost += cost
  }
  this.analyticsData.roundTheClock.push(item)
  //console.log(this.analyticsData.roundTheClock)
}
// by segmentCount
found = false
var segment = (message.segmentCount != undefined) ? parseInt(message.segmentCount) : 0
for (var i=0; i<this.analyticsData.segmentCounts.length; i++){
  var seg = this.analyticsData.segmentCounts[i]
  if (seg.count == segment){
    if (message.direction == "Outbound"){
      this.analyticsData.segmentCounts[i].outboundCount++
      switch (message.messageStatus) {
        case "Delivered":
        case "Sent":
          this.analyticsData.segmentCounts[i].deliveredCount++
          break
        case "DeliveryFailed":
          this.analyticsData.segmentCounts[i].deliveryFailedCount++
          break
        case "SendingFailed":
          this.analyticsData.segmentCounts[i].sendingFailedCount++
          break;
        default:
          break
      }
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.segmentCounts[i].sentMsgCost += cost
    }else{ // received messages
      this.analyticsData.segmentCounts[i].inboundCount++
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.segmentCounts[i].receivedMsgCost += cost
    }
    found = true
    break
  }
}
if (!found){
  var item = {
    count: segment,
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0,
  }
  if (message.direction == "Outbound"){
    item.outboundCount++
    switch (message.messageStatus) {
      case "Delivered":
      case "Sent":
        item.deliveredCount++
        break
      case "DeliveryFailed":
        item.deliveryFailedCount++
        break
      case "SendingFailed":
        item.sendingFailedCount++
        break;
      default:
        break
    }
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.sentMsgCost += cost
  }else{ // received messages
    item.inboundCount++
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.receivedMsgCost += cost
  }
  this.analyticsData.segmentCounts.push(item)
  //console.log(this.analyticsData.segmentCounts)
}

extractKeywords_old: function(message){
  var keywords = keyword_extractor.extract(message.text, {
      language:"english",
      remove_digits: true,
      return_changed_case: true,
      remove_duplicates: false

  });
  //console.log(keywords)
  //console.log("---")
  var code = (message.errorCode != undefined) ? message.errorCode : "Others"
  var matchedCount = 0
  for (var spam of this.failureDataAnalytics.contents){
    for (var kw of keywords){
      if (spam.keywords.findIndex(o => o == kw) >= 0)
        matchedCount++
    }
    if ((matchedCount > 0) && (matchedCount >= (spam.keywords.length-2))){
      //console.log("matchedCount " + matchedCount)
      //console.log("matched")
      var toNumber = message.to[0]
      if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
        spam.acceptedCount++
        if (spam.acceptedNumbers.findIndex(n => n === toNumber) < 0)
          spam.acceptedNumbers.push(toNumber)
      }else{
        if (code == "SMS-UP-430" || code == "SMS-CAR-430"){ // spam content
          spam.spamCount++
          if (spam.spamNumbers.findIndex(n => n === toNumber) < 0)
            spam.spamNumbers.push(toNumber)
        }else if (code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // content problem
          spam.flaggedCount++
          if (spam.flaggedNumbers.findIndex(n => n === toNumber) < 0)
            spam.flaggedNumbers.push(toNumber)
          if (spam.flaggedErrorCodes.findIndex(c => c === code) < 0)
            spam.flaggedErrorCodes.push(code)
          //spam.messages.push(message.text)
        }else if (code == "SMS-UP-410" || code == "SMS-CAR-411" || code == "SMS-CAR-412"){
          spam.invalidNumberCount++
          if (spam.invalidNumbers.findIndex(n => n === toNumber) < 0)
            spam.invalidNumbers.push(toNumber)
          if (spam.invalidErrorCodes.findIndex(c => c === code) < 0)
            spam.invalidErrorCodes.push(code)
        }else if (code == "SMS-CAR-413 "){  // opted out
          spam.optoutCount++
          if (spam.optoutNumbers.findIndex(n => n === toNumber) < 0)
            spam.optoutNumbers.push(toNumber)
        }else{
          spam.unknownCount++
          if (spam.unknownNumbers.findIndex(n => n === toNumber) < 0)
            spam.unknownNumbers.push(toNumber)
          if (spam.unknownErrorCodes.findIndex(c => c === code) < 0)
            spam.unknownErrorCodes.push(code)
        }
      }
      //console.log(this.failureDataAnalytics.contents)
      return
    }
    matchedCount = 0
  }
  if (keywords.length > 0){
    var item = {
        message: message.text,
        keywords: keywords,
        acceptedCount: 0,
        acceptedNumbers: [],
        spamCount: 0,
        spamNumbers: [],
        flaggedCount: 0,
        flaggedNumbers: [],
        flaggedErrorCodes: [],
        optoutCount: 0,
        optoutNumbers: [],
        invalidNumberCount: 0,
        invalidNumbers: [],
        invalidErrorCodes: [],
        unknownCount: 0,
        unknownNumbers: [],
        unknownErrorCodes: [],
        messages: []
      }

    var toNumber = message.to[0]
    if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
      item.acceptedCount++
      item.acceptedNumbers.push(toNumber)
    }else{
      if (code == "SMS-UP-430" || code == "SMS-CAR-430"){
        item.spamCount++
        item.spamNumbers.push(toNumber)
      }else if (code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // content problem
        item.flaggedCount++
        item.flaggedNumbers.push(toNumber)
        item.flaggedErrorCodes.push(code)
        //item.messages.push(message.text)
      }else if (code == "SMS-UP-410" || code == "SMS-CAR-411" || code == "SMS-CAR-412"){
        item.invalidNumberCount++
        item.invalidNumbers.push(toNumber)
        item.invalidErrorCodes.push(code)
      }else if (code == "SMS-CAR-413 "){  // opted out
        item.optoutCount++
        item.optoutNumbers.push(toNumber)
      }else{
        item.unknownCount++
        item.unknownNumbers.push(toNumber)
        item.unknownErrorCodes.push(code)
      }
    }
    this.failureDataAnalytics.push(item)
    //console.log(this.failureDataAnalytics)
  }
},
*/
