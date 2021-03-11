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
function init(){
  $( "#fromdatepicker" ).datepicker({ dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  var pastMonth = new Date();
  var day = pastMonth.getDate()  - 6
  var month = pastMonth.getMonth()
  var year = pastMonth.getFullYear()
  if (month < 0){
    month = 11
    year -= 1
  }
  $( "#fromdatepicker" ).datepicker('setDate', new Date(year, month, day));
  $( "#todatepicker" ).datepicker('setDate', new Date());
  timeOffset = new Date().getTimezoneOffset()*60000;
  var footer = $("#footer").height()
  var height = $(window).height() - $("#footer").outerHeight(true)
    window.onresize = function() {
        height = $(window).height() - $("#footer").outerHeight(true)
        var swindow = height - $("#menu_header").height()
        $("#message-col").height(swindow)
        $("#menu-pane").height(swindow)
        $("#control-list-col").height(swindow)

        $("#recipient-list").height(swindow - ($("#col2-header").height() + 50))
        $("#conversation").height(swindow - ($("#conversation-header").height() + 90))
    }
    var swindow = height - $("#menu_header").height()
    $("#message-col").height(swindow)
    $("#menu-pane").height(swindow)
    $("#control-list-col").height(swindow)

    $("#recipient-list").height(swindow - ($("#col2-header").height() + 50))
    $("#conversation").height(swindow - ($("#conversation-header").height() + 90))


    readMessageStore("")

  $('#send-text').keyup(function(e) {
      if(e.keyCode == 13) {
            $(this).trigger("enterKey");
      }
  });
  $('#send-text').on("enterKey", function(e){
    sendTextMessage($('#send-text').val())
    $('#send-text').val("")
  });
  contactList = JSON.parse(window.contactList)
}

var params = {
  from: "",
  to: "",
  message: ""
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
  //return alert(JSON.stringify(params))
  var url = "sendindividualmessage"
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      /*
      window.setTimeout(function(){
        readMessageStore(pageToken)
      },2000)
      */
      console.log("ok")
    }else if (res.status == "failed"){
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  posting.fail(function(response){
    alert(response);
  });
}

function pollNewMessages(){
  var url = "pollnewmessages"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      for (var msg of res.newMessages){
        //messageList.push(msg)
        messageList.splice(0, 0, msg);
        processResult()
      }
      pollingTimer = window.setTimeout(function(){
        pollNewMessages()
      },3000)
    }else
      alert(res.newMessages)
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
  console.log(`from: ${dateFromStr}`)
  console.log(`to: ${dateToStr}`)
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
  var readingAni = "<img src='./img/loading.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#conversation").html(readingAni)

  var url = "read-message-store"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      messageList = res.result
      //alert("res.pageTokens.nextPage")//res.pageTokens.nextPage
      processResult(res.pageTokens.nextPage)
      pollingTimer = window.setTimeout(function(){
        pollNewMessages()
      },3000)
    }else{
      $("#conversation").html("")
      alert(res.message)
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}
function listByDirection(elm){
  var dir = $(elm).val()

}

function processResult(nextPage){
  recipientPhoneNumbers = []
  dateStr = ""
  //var maxLen = messageList.length - 1
  for (var message of messageList){
  //for (var i=maxLen; i>=0; i--){
    //var message = messageList[i]
    if (message.direction == "Outbound"){
      var number = recipientPhoneNumbers.find(n => n === message.to[0])
      if (number == undefined){
        recipientPhoneNumbers.push(message.to[0])
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

function createRecipientsList(recipientPhoneNumbers){
  var html = `<div id='0' class='recipient-item' onclick='showConversation(0)'>All conversations</div>`
  for (var recipient of recipientPhoneNumbers){
    var id = parseInt(recipient)
    if (contactList.length > 0){
      var contact = contactList.find(o => o.phoneNumber === recipient)
      if (contact){
        var name = ` - ${contact.fname} ${contact.lname}`
        html += `<div id='${id}' class='recipient-item' onclick='showConversation("${recipient}", "${name}")'>${formatPhoneNumber(recipient)}${name}</div>`
      }else
        html += `<div id='${id}' class='recipient-item' onclick='showConversation("${recipient}", "")'>${formatPhoneNumber(recipient)}</div>`
    }else{
      html += `<div id='${id}' class='recipient-item' onclick='showConversation("${recipient}", "")'>${formatPhoneNumber(recipient)}</div>`
    }
  }
  $("#recipient-list").html(html)
  //selectedRecipient = undefined
  //alert(currentSelectedItem)
  /*
  if (currentSelectedItem != undefined){
    //alert($(currentSelectedItem).id)
    showConversation(currentSelectedItem)
  }else{
    //alert("currentSelectedItem is undefined")
    showConversation(currentSelectedItem)
  }
  */
  showConversation(currentSelectedItem, currentSelectedContact)
}

function showConversation(recipient, name){
  //alert(`#${recipient}`)
  //alert(currentSelectedItem)
  //if (currentSelectedItem != undefined){
  var id = parseInt(currentSelectedItem)
  //alert(id)
    $(`#${id}`).removeClass("active");
  //}
  id = parseInt(recipient)
  //alert(id)
  $(`#${id}`).addClass("active");
  //currentSelectedItem = elm
  currentSelectedItem = recipient
  currentSelectedContact = name
  if (messageList != undefined){

    var html = '<div class="chat-container"><ul class="chat-box chatContainerScroll">'
    dateStr = ""
    var totalMessage = 0
    if (recipient == 0){
      $("#message-input").hide()
      $("#conversation-title").html(`All conversations`)
      totalMessage = messageList.length
      var maxLen = totalMessage - 1
      //for (var msg of messageList){
      for (var i=maxLen; i>=0; i--){
        var msg = messageList[i]
        //for (var msg of messageList){
        html += createConversationItem(msg, false)
      }
    }else {
      params.to = recipient //selectedRecipient
      params.message = ""
      $("#message-input").show()
      $("#conversation-title").html(`${formatPhoneNumber(recipient)}${currentSelectedContact}`)

      var myNumbers = []
      var maxLen = messageList.length - 1
      //for (var msg of messageList){
      for (var i=maxLen; i>=0; i--){
        var msg = messageList[i]
        if (msg.direction == "Inbound"){
          if (recipient == msg.from){
            var number = myNumbers.indexOf(msg.to[0])
            if (number < 0)
              myNumbers.push(msg.to[0])
            html += createConversationItem(msg, true)
            totalMessage++
          }
        }else if (msg.direction == "Outbound"){
          if (recipient == msg.to[0]){
            var number = myNumbers.indexOf(msg.from)
            if (number < 0)
              myNumbers.push(msg.from)
            html += createConversationItem(msg, true)
            totalMessage++
          }
        }
      }
    }

    $("#total").html(`${totalMessage} messages`)
    html += "</ul></div>"
    $("#conversation").html(html)
    $("#conversation").animate({ scrollTop: $("#conversation")[0].scrollHeight}, 100);
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
      line += `<div class="chat-avatar chat-name"><a class="reply" href="javascript:openReplyForm('${item.from}', '${item.to[0]}')">${getContactName(item.from)}</a><br>${timeStr}</div>`
      line += `<div class="chat-text">${item.text}</div>`
    }
  }else{ // Outbound
    line += '<li class="chat-right">'
    if (conversation){
      if (item.messageStatus == "Delivered"){
        line += `<div class="chat-text">${item.text}</div>`
        line += `<div class="chat-avatar chat-name">${timeStr}</div>`

      }else{
        line += `<div class="chat-text error">${item.text}</div>`
        line += `<div class="chat-avatar chat-name">${timeStr}</div>` //${item.messageStatus}
      }
    }else{
      if (item.messageStatus == "Delivered"){
        line += `<div class="chat-text">${item.text}</div>`
      }else{
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
  var url = "downloadmessagestore?format=" + format + "&timeOffset=" + timeOffset
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
