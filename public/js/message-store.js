var messageList = undefined
var recipientPhoneNumbers = []
var timeOffset = 0
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
        $("#list").height(swindow)
    }
    var swindow = height - $("#menu_header").height()
    swindow -= $("#content_header").height()
    $("#list").height(swindow)
}

function readMessageStore(){
  var configs = {}
  configs['dateFrom'] = $("#fromdatepicker").val() + "T00:00:00.001Z"
  configs['dateTo'] = $("#todatepicker").val() + "T23:59:59.999Z"
  //configs['view'] = $("#view").val()
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
      var html = ''
      for (var message of messageList){
        html += createMessageItem(message)
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
      $("#list").html(html)
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
    var html = ''
    if (number == "all"){
        for (var msg of messageList){
          html += createMessageItem(msg)
        }
    }else {
      for (var msg of messageList){
        if (msg.direction == "Inbound"){
          if (number == msg.from)
            html += createMessageItem(msg)
        }else if (msg.direction == "Outbound"){
          if (number == msg.to[0])
            html += createMessageItem(msg)
        }
      }
    }
    $("#list").html(html)
  }
}

function createMessageItem(item){
  var line = ""
  var date = new Date(item.lastModifiedTime)
  var timestamp = date.getTime() - timeOffset
  var updatedDate = new Date (timestamp)
  var updatedDateStr = updatedDate.toLocaleDateString("en-US")
  updatedDateStr += " " + updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
  //var updatedTimeStr = updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
  if (item.direction == "Outbound"){
    line += '<div class="container">'
    line += `<span class="right">To: ${item.to[0]}</span>`
    line += `<p>${item.text}</p>`
    line += `<span class="time-right">${updatedDateStr}</span>`
  }else{
    line += '<div class="container darker">'
    line += `<span class="right">From: ${item.from}</span>`
    line += `<p>${item.text}</p>`
    line += `<span class="time-left">${updatedDateStr}</span>`
  }
  line += '</div>'
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
