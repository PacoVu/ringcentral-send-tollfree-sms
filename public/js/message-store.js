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

function readMessageStore(){
  var configs = {}

  var tempDate = new Date($("#fromdatepicker").val() + "T00:00:00.001Z")
  var tempTime = tempDate.getTime() + timeOffset
  var fromDateStr = new Date(tempTime).toISOString()
  configs['dateFrom'] = fromDateStr
  //configs['dateFrom'] = $("#fromdatepicker").val() + "T00:00:00.001Z"

  tempDate = new Date($("#todatepicker").val() + "T23:59:59.999Z")
  tempTime = tempDate.getTime() + timeOffset
  var toDateStr = new Date(tempTime).toISOString()
  //configs['dateTo'] = $("#todatepicker").val() + "T23:59:59.999Z"
  configs['dateTo'] = toDateStr

  configs['direction'] = $('#direction').val();
  if ($('#from_number').val() != ""){
    configs['phoneNumbers'] = JSON.stringify($('#from_number').val());
  }
  configs['timeOffset'] = timeOffset
  var url = "read_message_store"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      messageList = res.result
      recipientPhoneNumbers = []
      var html = '<div class="chat-container"><ul class="chat-box">'
      //var html =''
      for (var message of messageList){
        html += createConversationItem(message)
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
          value: "all",
          text : "All Recipients"
      })));
      for (var recipient of recipientPhoneNumbers){
        $("#recipients_list").append(($('<option>', {
            value: recipient,
            text : recipient
        })));
      }
      $('#recipients_list').selectpicker('refresh');
    }else{
      alert("error")
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}

function recipientSelected(){
  var number = $("#recipients_list").val()
  if (messageList != undefined){
    var html = `<div class="selected-user"><span>Conversation with <span class="name">${number}</span></span></div>`
    html += '<div class="chat-container"><ul class="chat-box chatContainerScroll">'
    dateStr = ""
    if (number == "all"){
        for (var msg of messageList){
          html += createConversationItem(msg)
        }
    }else {
      for (var msg of messageList){
        if (msg.direction == "Inbound"){
          if (number == msg.from)
            html += createConversationItem(msg)
        }else if (msg.direction == "Outbound"){
          if (number == msg.to[0])
            html += createConversationItem(msg)
        }
      }
    }
    html += "</ul></div>"
    $("#conversation").html(html)
  }
}

function createConversationItem(item){
  var line = ""
  var date = new Date(item.lastModifiedTime)
  var timestamp = date.getTime() - timeOffset
  var updatedDate = new Date (timestamp)
  var updatedDateStr = updatedDate.toISOString()
  updatedDateStr = updatedDateStr.replace("T", " ").substring(0, 19)
  var dateTime = updatedDateStr.split(" ")
  if (dateStr != dateTime[0]){
    dateStr = dateTime[0]
    // create date separation
    line += `<li class="separator"><div class="date-line">----- ${dateStr} ------</div></li>`
  }
  if (item.direction == "Outbound"){
    line += '<li class="chat-left">'
    line += `<div class="chat-avatar chat-name">From<br>${item.from}</div>`
    line += `<div class="chat-text">${item.text}</div>`
    line += `<div class="chat-hour">Sent<br>${dateTime[1]}</div>`
  }else{
    line += '<li class="chat-right">'
    line += `<div class="chat-hour">Received<br>${dateTime[1]}</div>`
    line += `<div class="chat-text">${item.text}</div>`
    line += `<div class="chat-avatar chat-name">From<br>${item.from}</div>`
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

function logout(){
  window.location.href = "index?n=1"
}
