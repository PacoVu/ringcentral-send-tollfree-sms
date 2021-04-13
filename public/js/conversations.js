var messageList = []
var recipientPhoneNumbers = []
var timeOffset = 0
var dateStr = ""
//var selectedRecipient = undefined
var pageToken = undefined
var currentSelectedItem = "0"
var currentSelectedContact = ""
var pollingTimer = null
var contactList = []
var params = {
  from: "",
  to: "",
  message: ""
}
var conversationHeight = 50
function init(){
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "conversations"
  $(`#${mainMenuItem}`).addClass("active")

  readContacts()

  $('#send-text').keyup(function(e) {
    if(e.keyCode == 13) {
      $(this).trigger("enterKey");
    }
  });
  $('#send-text').on("enterKey", function(e){
    sendTextMessage($('#send-text').val())
    $('#send-text').val("")
  });

  timeOffset = new Date().getTimezoneOffset()*60000;

  $( "#fromdatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});

  var past30Days = new Date().getTime() - (86400000 * 30)

  $( "#fromdatepicker" ).datepicker('setDate', new Date(past30Days));
  $( "#todatepicker" ).datepicker('setDate', new Date());
}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()
  $("#message-col").height(swindow)
  $("#menu-pane").height(swindow)
  $("#control-list-col").height(swindow)

  $("#recipient-list").height(swindow - ($("#col2-header").outerHeight(true) + 120))
  $("#conversation").height(swindow - ($("#conversation-header").outerHeight(true) + conversationHeight))
}

function searchRecipientName(name){
  for (var contact of contactList){
    var fullName = `${contact.fname} ${contact.lname}`
    if (fullName.toLowerCase().indexOf(name.toLowerCase()) >= 0){
      //var number = contact.phoneNumber
      var recipient = recipientPhoneNumbers.find(o => o.number == contact.phoneNumber)
      if (recipient){
        showConversation(contact.phoneNumber, ` - ${fullName}`, true)
        var id = parseInt(contact.phoneNumber)
        var element = document.getElementById(`${id}`)
        var topPos = element.offsetTop;
        document.getElementById('recipient-list').scrollTop = topPos;
        element.scrollIntoView()
        return
      }
    }
  }
  showConversation(0)
}

function clearSearch(elm){
  $(elm).val('')
}

function searchRecipientNumber(elm){
  var number = $(elm).val()
  if (number.length < 3)
    return

  if (isNaN(number)){
    console.log(number)
    searchRecipientName(number)
    return
  }

  //var index = 0
  for (var recipient of recipientPhoneNumbers){
    if (recipient.number.indexOf(number) >= 0){
      var contact = contactList.find(o => o.phoneNumber === recipient.number)
      var name = ""
      if (contact)
        var name = ` - ${contact.fname} ${contact.lname}`
      showConversation(recipient.number, name, true)

      var id = parseInt(recipient.number)
      var element = document.getElementById(`${id}`)
      var topPos = element.offsetTop;
      document.getElementById('recipient-list').scrollTop = topPos;
      element.scrollIntoView()
      return
    }
  }
  showConversation(0)
}

function readContacts(){
  var url = "get-contacts"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      for (var contactGroup of res.contactList){
        for (var contact of contactGroup.contacts){
          if (contactList.length > 0){
            var item = contactList.find(o => o.phoneNumber == contact.phoneNumber)
            if (!item)
              contactList.push(contact)
          }else{
            contactList.push(contact)
          }
        }
      }
      //contactList = res.contactList
      //console.log(JSON.stringify(contactList))
      readMessageStore("")
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "/relogin"
    }else{
      alert(res.message)
    }
  });
}

function sendTextMessage(message){
  if (message == ""){
    $("#send-text").focus()
    return alert("Please enter text message!")
  }
  if (params.from == ""){
    if (!$("#my-numbers").val()){
      return alert("please select the 'from' number")
    }else{
      params.from = $("#my-numbers").val()
    }
  }
  params.message = message
  var url = "sendindividualmessage"
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      ;
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
  posting.fail(function(response){
    alert(response);
  });
}

function pollNewMessages(){
  var url = "poll-new-messages"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      for (var msg of res.newMessages){
        messageList.splice(0, 0, msg);
        processResult()
      }
      pollingTimer = window.setTimeout(function(){
        pollNewMessages()
      },3000)
    }else{
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function readMessageStore(token){
  var period = $("#period").val()
  if (period == "between"){
    if(!$("#between-date").is(":visible")){
      $("#between-date").show()
      return
    }
  }else{
    $("#between-date").hide()
  }
  var dateFromStr = ""
  var timestamp = new Date().getTime()
  var dateToStr = new Date(timestamp).toISOString()
  switch (period) {
    case "last-hour":
      timestamp -= 3600000
      dateFromStr = new Date(timestamp).toISOString()
      break
    case "last-24hour":
      timestamp -= 86400000
      dateFromStr = new Date(timestamp).toISOString()
      break
    case "last-seven-day":
      timestamp -= (86400000 * 7)
      dateFromStr = new Date(timestamp).toISOString()
      break
    case "between":
      var tempDate = new Date($("#fromdatepicker").val() + "T00:00:00.001Z")
      var tempTime = tempDate.getTime()// + timeOffset
      dateFromStr = new Date(tempTime).toISOString()

      tempDate = new Date($("#todatepicker").val() + "T23:59:59.999Z")
      tempTime = tempDate.getTime()// + timeOffset
      dateToStr = new Date(tempTime).toISOString()
      break
    default:
      return
  }

  var configs = {}
  configs['dateFrom'] = dateFromStr
  configs['dateTo'] = dateToStr
  //console.log(`from: ${dateFromStr}`)
  //console.log(`to: ${dateToStr}`)
  if (token){
    configs['pageToken'] = token
    pageToken = token
  }else{
    window.clearTimeout(pollingTimer)
  }

  configs['direction'] = $('#direction').val();

  if ($('#my-numbers').length > 0){
    var fromNumber = $('#my-numbers').val()
    configs['phoneNumbers'] = `["${fromNumber}"]`
    params.from = fromNumber
  }else{
    var numbersObj = JSON.parse(window.phoneNumbers)
    configs['phoneNumbers'] = `["${numbersObj[0].number}"]`
    params.from = numbersObj[0].number
  }
  //return alert(configs.phoneNumbers)
  messageList = []
  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#conversation").html(readingAni)

  var url = "read-message-store"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      $("#search-number").focus()
      messageList = res.result
      processResult(res.pageTokens.nextPage)
      pollingTimer = window.setTimeout(function(){
        pollNewMessages()
      },3000)
    }else if (res.status == "error"){
      $("#conversation").html("")
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}
/*
function directionFilter(elm){
  var dir = $(elm).val()
  var totalInbound = 0
  var totalOutbound = 0
  recipientPhoneNumbers = []
  if (dir == "Outbound"){
    for (var message of messageList){
      if (message.direction == dir){
        totalOutbound++
        var recipient = recipientPhoneNumbers.find(o => o.number === message.to[0])
        if (recipient == undefined){
          if (message.messageStatus != "SendingFailed"){
            var item = {
              outbound: 1,
              inbound: 0,
              number: message.to[0]
            }
            recipientPhoneNumbers.push(item)
          }
        }else{
          recipient.outbound++
        }
      }
    }
  }else if (dir == "Inbound"){
    for (var message of messageList){
      if (message.direction == dir){
        totalInbound++
        var recipient = recipientPhoneNumbers.find(o => o.number === message.from)
        if (recipient == undefined){
          var item = {
                outbound: 0,
                inbound: 1,
                number: message.from
          }
          recipientPhoneNumbers.push(item)
        }else{
          recipient.inbound++
        }
      }
    }
  }
    // check if the current selected number is still existed
  var exist = recipientPhoneNumbers.find(o => o.number === currentSelectedItem)
  if (exist == undefined)
    currentSelectedItem = 0
  createRecipientsList(recipientPhoneNumbers, totalOutbound, totalInbound)
}
*/

function processResult(nextPage){
  var totalInbound = 0
  var totalOutbound = 0
  recipientPhoneNumbers = []
  for (var message of messageList){
    if (message.direction == "Outbound"){
      totalOutbound++
      var recipient = recipientPhoneNumbers.find(o => o.number === message.to[0])
      if (recipient == undefined){
        if (message.messageStatus != "SendingFailed"){
          var item = {
            outbound: 1,
            inbound: 0,
            number: message.to[0]
          }
          recipientPhoneNumbers.push(item)
        }
      }else{
        recipient.outbound++
      }
    }else{
      totalInbound++
      var recipient = recipientPhoneNumbers.find(o => o.number === message.from)
      if (recipient == undefined){
        var item = {
          outbound: 0,
          inbound: 1,
          number: message.from
        }
        recipientPhoneNumbers.push(item)
      }else{
        recipient.inbound++
      }
    }
  }
  var exist = recipientPhoneNumbers.find(o => o.number === currentSelectedItem)
  if (exist == undefined)
  currentSelectedItem = 0
  $("#left_pane").show()
  $("#downloads").show()

  createRecipientsList(recipientPhoneNumbers, totalOutbound, totalInbound)

  if (nextPage){
    var link = $("#next-block");
    link.attr("href",`javascript:readMessageStore("${nextPage}")`);
    link.css('display', 'inline');
  }else {
    $("#next-page").hide()
  }
}
/*
function processResult(nextPage){
  recipientPhoneNumbers = []
  dateStr = ""
  for (var message of messageList){
    if (message.direction == "Outbound"){
      var number = recipientPhoneNumbers.find(n => n === message.to[0])
      if (number == undefined){
        if (message.messageStatus != "SendingFailed"){
          recipientPhoneNumbers.push(message.to[0])
        }
      }
    }else{
      var number = recipientPhoneNumbers.find(n => n === message.from)
      if (number == undefined){
        recipientPhoneNumbers.push(message.from)
      }
    }
  }
  // check if the current selected number is still existed
  var exist = recipientPhoneNumbers.find(n => n === currentSelectedItem)
  //alert(exist)
  if (exist == undefined)
    currentSelectedItem = 0
  $("#left_pane").show()
  $("#downloads").show()

  createRecipientsList(recipientPhoneNumbers)

  if (nextPage){
    var link = $("#next-block");
    link.attr("href",`javascript:readMessageStore("${nextPage}")`);
    link.css('display', 'inline');
  }else {
    $("#next-page").hide()
  }
}
*/
function createRecipientsList(recipientPhoneNumbers, totalOutbound, totalInbound){
  var html = `<div id='0' class='recipient-item' onclick='showConversation(0)'><div class="recipient-info">All conversations</div><div class="message-count">${totalInbound}/${totalOutbound}</div></div>`
  for (var recipient of recipientPhoneNumbers){
    var id = parseInt(recipient.number)
    if (contactList.length > 0){
      var contact = contactList.find(o => o.phoneNumber === recipient.number)
      if (contact){
        var name = ` - ${contact.fname} ${contact.lname}`
        html += `<div id='${id}' class='recipient-item' onclick='showConversation("${recipient.number}", "${name}")'>`
        html += `<span class="recipient-info">${formatPhoneNumber(recipient.number, true)}${name}</span><span class="message-count">${recipient.inbound}/${recipient.outbound}</span>`
      }else{
        html += `<div id='${id}' class='recipient-item' onclick='showConversation("${recipient.number}", "")'>`
        html += `<span class="recipient-info">${formatPhoneNumber(recipient.number, true)}</span><span class="message-count">${recipient.inbound}/${recipient.outbound}</span>`
      }
    }else{
      html += `<div id='${id}' class='recipient-item' onclick='showConversation("${recipient.number}", "")'>`
      html += `<span class="recipient-info">${formatPhoneNumber(recipient.number, true)}</span><span class="message-count"">${recipient.inbound}/${recipient.outbound}</span>`
    }
    html += "</div>"
  }
  $("#recipient-list").html(html)
  showConversation(currentSelectedItem, currentSelectedContact)
}

function showConversation(recipient, name, fromSearch){
  var id = parseInt(currentSelectedItem)
  $(`#${id}`).removeClass("active");
  id = parseInt(recipient)
  $(`#${id}`).addClass("active");
  currentSelectedItem = recipient
  currentSelectedContact = name
  if (messageList != undefined){
    var html = '<div class="chat-container"><ul class="chat-box chatContainerScroll">'
    dateStr = ""
    //var totalMessage = 0
    if (recipient == 0){
      $("#message-input").hide()
      conversationHeight = 50
      setElementsHeight()
      $("#conversation-title").html(`All conversations`)
      //totalMessage = messageList.length
      var maxLen = messageList.length - 1
      for (var i=maxLen; i>=0; i--){
        var msg = messageList[i]
        html += createConversationItem(msg, false)
      }
    }else {
      conversationHeight = 312
      setElementsHeight()
      params.to = recipient //selectedRecipient
      params.message = ""
      $("#message-input").show()
      var title = `<span>${formatPhoneNumber(recipient)}${currentSelectedContact}</span> <a href="rcapp://r/call?number=${recipient}"><img src="../img/call.png" class="medium-icon"></img></a>`
      $("#conversation-title").html(title)

      var myNumbers = []
      var maxLen = messageList.length - 1
      for (var i=maxLen; i>=0; i--){
        var msg = messageList[i]
        if (msg.direction == "Inbound"){
          if (recipient == msg.from){
            var number = myNumbers.indexOf(msg.to[0])
            if (number < 0)
              myNumbers.push(msg.to[0])
            html += createConversationItem(msg, true)
            //totalMessage++
          }
        }else if (msg.direction == "Outbound"){
          if (recipient == msg.to[0]){
            var number = myNumbers.indexOf(msg.from)
            if (number < 0)
              myNumbers.push(msg.from)
            html += createConversationItem(msg, true)
            //totalMessage++
          }
        }
      }
    }
    //$("#total").html(`${totalMessage} messages`)
    html += "</ul></div>"
    $("#conversation").html(html)
    $("#conversation").animate({ scrollTop: $("#conversation")[0].scrollHeight}, 100);
    if (!fromSearch)
      $("#send-text").focus()
  }
}

function createConversationItem(item, conversation){
  var line = ""
  var date = new Date(item.lastModifiedTime)
  var timestamp = date.getTime() - timeOffset
  var createdDate = new Date (timestamp)
  let dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'  }
  var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
  var timeStr =  createdDate.toISOString().substr(11, 5)
  if (dateStr != createdDateStr){
    dateStr = createdDateStr
    // create date separation
    line += `<li class="separator"><div class="date-line">----- ${dateStr} -----</div></li>`
  }
  if (item.direction == "Inbound"){
    line += '<li class="chat-left">'
    if (conversation){
      line += `<div class="chat-avatar chat-name">${timeStr}</div>`
      line += `<div class="chat-text">${item.text}</div>`
    }else{
      line += `<div class="chat-avatar chat-name"><a class="reply" href="#" onclick="openReplyForm('${item.from}', '${item.to[0]}');return false;">${getContactName(item.from)}</a><br>${timeStr}</div>`
      line += `<div class="chat-text">${item.text}</div>`
    }
  }else{ // Outbound
    line += '<li class="chat-right">'
    if (conversation){
      if (item.messageStatus == "Delivered"){
        line += `<div class="chat-text">${item.text}</div>`
      }else if (item.messageStatus == "Queued" || item.messageStatus == "Sent"){
        line += `<div class="chat-avatar chat-hour">Pending&nbsp;</div>`
        line += `<div class="chat-text warning">${item.text}</div>`
      }else{
        line += `<div class="chat-avatar chat-hour">Failed&nbsp;</div>`
        line += `<div class="chat-text error">${item.text}</div>`
      }
      line += `<div class="chat-avatar chat-name">${timeStr}</div>`
    }else{
      if (item.messageStatus == "Delivered"){
        line += `<div class="chat-text">${item.text}</div>`
      }else if (item.messageStatus == "Queued" || item.messageStatus == "Sent"){
        line += `<div class="chat-avatar chat-hour">Pending&nbsp;</div>`
        line += `<div class="chat-text warning">${item.text}</div>`
      }else{
        line += `<div class="chat-avatar chat-hour">Failed&nbsp;</div>`
        line += `<div class="chat-text error">${item.text}</div>`
      }
      line += `<div class="chat-avatar chat-name">${timeStr}<br>To: ${getContactName(item.to[0])}</div>`
    }
  }
  line += '</li>'
  return line
}

function getContactName(number){
  var contact = contactList.find(o => o.phoneNumber === number)
  if (contact)
    return `${contact.fname} ${contact.lname}`

  return formatPhoneNumber(number)
}

function downloadMessageStore(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "download-hv-message-store?format=" + format + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}

function validateRicipientNumber(number){
  if (number[0] != "+"){
    alert("Please enter recipient phone number with the plus (+) sign in front of country code!")
    return false
  }
  return true
}

function logout(){
  window.location.href = "index?n=1"
}
