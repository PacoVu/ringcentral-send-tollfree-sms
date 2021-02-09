var messageList = undefined
var recipientPhoneNumbers = []
var timeOffset = 0
var dateStr = ""
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

  var height = $(window).height() - 150;
    window.onresize = function() {
        height = $(window).height() - 150;
        var swindow = height - $("#menu_header").height()
        swindow -= $("#content_header").height()
        $("#conversation").height(swindow)
    }
    var swindow = height - $("#menu_header").height()
    swindow -= $("#content_header").height()
    $("#conversation").height(swindow)
}

function readMessageStore(token){
  var configs = {}
  var tempDate = new Date($("#fromdatepicker").val() + "T00:00:00.001Z")
  var tempTime = tempDate.getTime() + timeOffset
  var fromDateStr = new Date(tempTime).toISOString()
  configs['dateFrom'] = fromDateStr
  //configs['dateFrom'] = $("#fromdatepicker").val() + "T00:00:00.001Z"
  if (token)
    configs['pageToken'] = token

  tempDate = new Date($("#todatepicker").val() + "T23:59:59.999Z")
  tempTime = tempDate.getTime() + timeOffset
  var toDateStr = new Date(tempTime).toISOString()
  //configs['dateTo'] = $("#todatepicker").val() + "T23:59:59.999Z"
  configs['dateTo'] = toDateStr

  configs['direction'] = $('#direction').val();

  var recipientNumber = $('#recipient_number').val().trim()
  if ($('#my_numbers').val() != ""){
    var numbersFilter = $('#my_numbers').val()
    if (recipientNumber != ""){
      if (validateRicipientNumber(recipientNumber))
        numbersFilter.push(recipientNumber)
      else{
        $('#recipient_number').focus()
        return
      }
    }
    configs['phoneNumbers'] = JSON.stringify(numbersFilter);
  }else{
    if (recipientNumber != ""){
      if (validateRicipientNumber(recipientNumber))
        configs['phoneNumbers'] = JSON.stringify([recipientNumber]);
      else{
        $('#recipient_number').focus()
        return
      }
    }
  }

  configs['timeOffset'] = timeOffset
  messageList = []
  var readingAni = "<img src='./img/loading.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#conversation").html(readingAni)

  var url = "read_message_store"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      messageList = res.result
      recipientPhoneNumbers = []
      dateStr = ""
      var html = '<div class="chat-container"><ul class="chat-box">'
      //var html =''
      for (var message of messageList){
        html += createConversationItem(message, false)
        if (message.direction == "Outbound"){
          var number = recipientPhoneNumbers.find(n => n === message.to[0])
          if (number == undefined)
            recipientPhoneNumbers.push(message.to[0])
        }else{
          var number = recipientPhoneNumbers.find(n => n === message.from)
          if (number == undefined)
            recipientPhoneNumbers.push(message.from)
        }
      }
      html += "</ul></div>"
      $("#conversation").html(html)
      $("#left_pane").show()
      $("#downloads").show()
      $("#recipients_list").empty()
      $("#recipients_list").append(($('<option>', {
          value: "all recipients",
          text : "All Recipients"
      })));
      for (var recipient of recipientPhoneNumbers){
        $("#recipients_list").append(($('<option>', {
            value: recipient,
            text : recipient
        })));
      }
      $('#recipients_list').selectpicker('refresh');

      $("#total").html(`${messageList.length} messages`)
      $("#conversation-header").html("Conversations with all recipients")
      // make page link
      /*
      if (res.pageTokens.previousPage){
        //$("#pages").show()
        var link = $("#prev-page");
        link.attr("href",`javascript:readMessageStore("${res.pageTokens.previousPage}","prev")`);
        link.css('display', 'inline');
        $("#hyphen").show()
      }else {
        $("#prev-page").hide()
        $("#hyphen").hide()
      }
      */
      if (res.pageTokens.nextPage){
        var link = $("#next-block");
        link.attr("href",`javascript:readMessageStore("${res.pageTokens.nextPage}")`);
        link.css('display', 'inline');
      }else {
        $("#next-page").hide()
      }
    }else{
      $("#conversation").html("")
      alert(res.message)
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}

function recipientSelected(){
  var number = $("#recipients_list").val()
  if (messageList != undefined){
    $("#conversation-header").html(`Conversations with ${number}`)
    var html = '<div class="chat-container"><ul class="chat-box chatContainerScroll">'
    dateStr = ""
    var totalMessage = 0
    if (number == "all recipients"){
      totalMessage = messageList.length
        for (var msg of messageList){
          html += createConversationItem(msg, false)
        }
    }else {
      for (var msg of messageList){
        if (msg.direction == "Inbound"){
          if (number == msg.from){
            html += createConversationItem(msg, true)
            totalMessage++
          }
        }else if (msg.direction == "Outbound"){
          if (number == msg.to[0]){
            html += createConversationItem(msg, true)
            totalMessage++
          }
        }
      }
    }
    $("#total").html(`${totalMessage} messages`)
    html += "</ul></div>"
    $("#conversation").html(html)
  }
}

function createConversationItem(item, conversation){
  var line = ""
  var date = new Date(item.lastModifiedTime)
  var timestamp = date.getTime() - timeOffset
  var updatedDate = new Date (timestamp)
  var updatedDateStr = updatedDate.toISOString()
  updatedDateStr = updatedDateStr.substring(0, 19)
  var dateTime = updatedDateStr.split("T")
  if (dateStr != dateTime[0]){
    dateStr = dateTime[0]
    // create date separation
    line += `<li class="separator"><div class="date-line">----- ${dateStr} -----</div></li>`
  }
  if (item.direction == "Outbound"){
    line += '<li class="chat-left">'
    if (conversation)
      line += `<div class="chat-avatar chat-name"><br>${item.from}</div>`
    else
      line += `<div class="chat-avatar chat-name">${item.from}<br>to: ${item.to[0]}</div>`
    if (item.messageStatus == "Delivered"){
      line += `<div class="chat-text">${item.text}</div>`
      line += `<div class="chat-hour">sent<br>${dateTime[1]}</div>`
    }else{
      line += `<div class="chat-text error">${item.text}</div>`
      line += `<div class="chat-hour">failed<br>${dateTime[1]}</div>`
    }
  }else{
    line += '<li class="chat-right">'
    line += `<div class="chat-hour">received<br>${dateTime[1]}</div>`
    line += `<div class="chat-text">${item.text}</div>`
    if (conversation)
      line += `<div class="chat-avatar chat-name"><br>${item.from}</div>`
    else
      line += `<div class="chat-avatar chat-name">${item.from}<br>to: ${item.to[0]}</div>`
  }
  line += '</li>'
  return line
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
